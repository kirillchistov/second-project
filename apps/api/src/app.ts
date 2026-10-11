/**
 * HTTP-слой: проверка доступа, квота и валидация запросов. Модель подставляется снаружи —
 * в тестах это заглушка, в main.ts — Claude.
 */
import type { Question } from '@rr/content';
import type { Rubric } from '@rr/content/rubrics';
import { MAX_ANSWER_CHARS, MIN_ANSWER_CHARS, type GradeResult } from '@rr/core';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildResult, type Examiner } from './examiner.ts';

export interface AppOptions {
  questions: readonly Question[];
  rubrics: readonly Rubric[];
  examiner: Examiner;
  /** Общий токен для своих: без него API открыт (удобно локально) */
  token?: string;
  /** Сколько обращений к модели в сутки на устройство */
  dailyLimit?: number;
  now?: () => Date;
}

const gradeBody = z.object({
  question: z.string(),
  answer: z.string().max(MAX_ANSWER_CHARS),
  hints: z.number().int().min(0).max(10).default(0),
});

const hintBody = z.object({
  question: z.string(),
  answer: z.string().max(MAX_ANSWER_CHARS).default(''),
  level: z.number().int().min(1).max(3).default(1),
});

export function createApp(options: AppOptions) {
  const { examiner, token, dailyLimit = 150, now = () => new Date() } = options;
  const questionBySlug = new Map(options.questions.map((q) => [q.slug, q]));
  const rubricBySlug = new Map(options.rubrics.map((r) => [r.question, r]));
  // Квота в памяти процесса: для своих этого достаточно, при деплое её заменит хранилище
  const usage = new Map<string, number>();

  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, rubrics: rubricBySlug.size }));

  app.use('/v1/*', async (c, next) => {
    if (token && c.req.header('authorization') !== `Bearer ${token}`) return c.json({ error: 'unauthorized' }, 401);
    const device = c.req.header('x-device-id') ?? 'anonymous';
    const key = `${now().toISOString().slice(0, 10)}:${device}`;
    const count = (usage.get(key) ?? 0) + 1;
    if (count > dailyLimit) return c.json({ error: 'daily_limit', message: 'Лимит проверок на сегодня исчерпан' }, 429);
    usage.set(key, count);
    await next();
  });

  /** Вопрос и рубрика по slug — или ответ с ошибкой */
  function lookup(slug: string) {
    const question = questionBySlug.get(slug);
    const rubric = rubricBySlug.get(slug);
    if (!question) return { error: 'unknown_question' as const };
    if (!rubric) return { error: 'no_rubric' as const };
    return { question, rubric };
  }

  app.post('/v1/grade', async (c) => {
    const body = gradeBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', message: z.prettifyError(body.error) }, 400);
    const found = lookup(body.data.question);
    if ('error' in found) return c.json({ error: found.error }, 404);

    const answer = body.data.answer.trim();
    // Пустой ответ не отправляем модели: это пропуск — все пункты не раскрыты
    if (answer.length < MIN_ANSWER_CHARS) {
      const empty: GradeResult = {
        ...buildResult(found.rubric, { points: [], errors: [], feedback: '', followUp: '' }, body.data.hints),
        feedback: 'Ответ слишком короткий, чтобы его оценить. Попробуй рассказать своими словами хотя бы главную мысль.',
      };
      return c.json(empty);
    }
    try {
      const output = await examiner.grade(found.question, found.rubric, answer);
      return c.json(buildResult(found.rubric, output, body.data.hints));
    } catch (error) {
      console.error('grade failed', error);
      return c.json({ error: 'examiner_failed' }, 502);
    }
  });

  app.post('/v1/hint', async (c) => {
    const body = hintBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad_request', message: z.prettifyError(body.error) }, 400);
    const found = lookup(body.data.question);
    if ('error' in found) return c.json({ error: found.error }, 404);
    try {
      const hint = await examiner.hint(found.question, found.rubric, body.data.answer.trim(), body.data.level);
      return c.json({ hint });
    } catch (error) {
      console.error('hint failed', error);
      return c.json({ error: 'examiner_failed' }, 502);
    }
  });

  return app;
}
