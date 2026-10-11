/**
 * Экзаменатор: оценивает устный ответ по рубрике и даёт сократовские подсказки.
 * Правило режима «Думай сам»: ИИ не выдаёт ответ до попытки, подсказка — только наводящий вопрос.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { Question } from '@rr/content';
import type { Rubric } from '@rr/content/rubrics';
import { outcomeFor, scorePoints, verdictFor, type GradeResult, type GradedPoint, type PointStatus } from '@rr/core';
import { z } from 'zod';

export const GRADER_MODEL = process.env.GRADER_MODEL ?? 'claude-haiku-5-5';

// ─── Промпты ─────────────────────────────────────────────────────────────────

export const GRADER_SYSTEM = `Ты — строгий, но доброжелательный интервьюер по React и фронтенду.
Кандидат устно ответил на вопрос. Ответ получен распознаванием речи: в нём могут быть ошибки распознавания
терминов («юз эффект» = useEffect, «реакт квери» = React Query). Не снижай оценку за такие искажения,
оценивай смысл.

Для каждого пункта рубрики определи статус по тому, что действительно сказано в ответе:
- covered — мысль высказана верно, пусть другими словами;
- partial — затронута, но неполно или неточно;
- missing — не прозвучала.
Не засчитывай пункт за общие слова, которые его не раскрывают.

errors — фактические ошибки в ответе (особенно из списка типичных заблуждений). Одно короткое предложение
на ошибку. Если ошибок нет — пустой список. Неполнота — это не ошибка.

feedback — 1–2 предложения на «ты»: что было сильным и что главное добавить. Без воды и комплиментов.
followUp — один уточняющий вопрос, который задал бы интервьюер следующим, по теме пропущенного или на углубление.`;

export const HINT_SYSTEM = `Ты — наставник, который помогает вспомнить ответ, но не подсказывает его.
Тебе дают вопрос, рубрику хорошего ответа и то, что кандидат уже сказал (может быть пусто).
Выбери самый важный пункт рубрики, которого нет в ответе, и задай один наводящий вопрос, который приведёт к нему.

Уровень подсказки:
- 1 — общий вопрос-направление («Подумай, что происходит со старым эффектом, когда меняются зависимости?»);
- 2 — уже конкретнее: сузь область, приведи ситуацию;
- 3 — почти подсказка: обязательно назови ключевое понятие, механизм или API из пункта (например, «reconciliation», «cleanup», «Object.is»), но не объясняй, как оно работает.
Каждый следующий уровень должен быть заметно конкретнее предыдущего.

Нельзя: формулировать сам пункт рубрики, давать готовое объяснение, перечислять несколько пунктов.
Один вопрос, до 160 символов, на «ты».`;

function rubricText(rubric: Rubric): string {
  const points = rubric.points.map((p) => `- [${p.id}] (вес ${p.weight}) ${p.text}`).join('\n');
  const misconceptions = rubric.misconceptions.map((m) => `- ${m}`).join('\n');
  return `Рубрика:\n${points}\n\nТипичные заблуждения:\n${misconceptions || '- нет'}`;
}

export function gradePrompt(question: Question, rubric: Rubric, answer: string): string {
  return `Вопрос: ${question.title}\n\n${rubricText(rubric)}\n\nОтвет кандидата:\n"""\n${answer}\n"""`;
}

export function hintPrompt(question: Question, rubric: Rubric, answer: string, level: number): string {
  return `Вопрос: ${question.title}\n\n${rubricText(rubric)}\n\nКандидат уже сказал:\n"""\n${answer || '(пока ничего)'}\n"""\n\nУровень подсказки: ${level}`;
}

// ─── Ответ модели ────────────────────────────────────────────────────────────

const gradeOutput = z.object({
  points: z.array(z.object({ id: z.string(), status: z.enum(['covered', 'partial', 'missing']) })),
  errors: z.array(z.string()),
  feedback: z.string(),
  followUp: z.string(),
});
export type GradeOutput = z.infer<typeof gradeOutput>;

const hintOutput = z.object({ hint: z.string() });

/** Ответ модели + рубрика → итог. Пункты, которые модель пропустила, считаются нераскрытыми. */
export function buildResult(rubric: Rubric, output: GradeOutput, hintsUsed: number): GradeResult {
  const status = new Map(output.points.map((p) => [p.id, p.status]));
  const points: GradedPoint[] = rubric.points.map((p) => ({ ...p, status: status.get(p.id) ?? ('missing' as PointStatus) }));
  const errors = output.errors.map((e) => e.trim()).filter(Boolean);
  const verdict = verdictFor(points, errors);
  return {
    score: scorePoints(points),
    verdict,
    points,
    errors,
    feedback: output.feedback.trim(),
    followUp: output.followUp.trim(),
    outcome: outcomeFor(verdict, hintsUsed),
  };
}

// ─── Вызовы Claude ───────────────────────────────────────────────────────────

export class ExaminerError extends Error {}

export interface Examiner {
  grade(question: Question, rubric: Rubric, answer: string): Promise<GradeOutput>;
  hint(question: Question, rubric: Rubric, answer: string, level: number): Promise<string>;
}

export function claudeExaminer(client: Anthropic, model = GRADER_MODEL): Examiner {
  async function call<T>(system: string, content: string, schema: z.ZodType<T>, effort: 'low' | 'medium'): Promise<T> {
    const message = await client.messages.parse({
      model,
      max_tokens: 16000,
      output_config: { effort, format: zodOutputFormat(schema) },
      // Системные промпты одинаковые для всех запросов — кешируем
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content }],
    });
    if (message.stop_reason === 'refusal') throw new ExaminerError('модель отказалась отвечать');
    if (message.stop_reason === 'max_tokens') throw new ExaminerError('ответ модели обрезан');
    if (!message.parsed_output) throw new ExaminerError('ответ модели не соответствует схеме');
    return message.parsed_output;
  }

  return {
    grade: (question, rubric, answer) => call(GRADER_SYSTEM, gradePrompt(question, rubric, answer), gradeOutput, 'medium'),
    // Подсказка должна приходить быстро — думать долго не нужно
    hint: async (question, rubric, answer, level) =>
      (await call(HINT_SYSTEM, hintPrompt(question, rubric, answer, level), hintOutput, 'low')).hint.trim(),
  };
}
