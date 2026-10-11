import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import { GAP } from './format.ts';

export { GAP };

const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ожидается kebab-case');
const text = z.string().trim().min(1);

const base = {
  id: kebab,
  /** Атом навыка: то, что планировщик повторений отслеживает как единицу знания */
  skill: kebab,
  /** slug вопроса из банка, где разобрана теория */
  question: kebab.optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
  prompt: text,
  /** Разбор после ответа: почему правильный вариант правильный */
  explanation: text,
};

const language = z.enum(['tsx', 'ts', 'jsx', 'js']).default('tsx');

/** Предскажи вывод: код → выбрать, что окажется в консоли или на экране. */
const predictOutput = z.object({
  ...base,
  type: z.literal('predict-output'),
  language,
  code: text,
  options: z.array(text).min(2),
  answer: z.number().int().nonnegative(),
});

/** Найди баг: тапнуть строку(и) с ошибкой, затем выбрать причину. */
const findBug = z.object({
  ...base,
  type: z.literal('find-bug'),
  language,
  code: text,
  /** Номера строк с ошибкой, с 1; засчитывается тап по любой из них */
  bugLines: z.array(z.number().int().positive()).min(1),
  causes: z.array(text).min(2),
  answer: z.number().int().nonnegative(),
});

/** Пазл Парсонса: собрать код из перемешанных строк, не взяв строки-ловушки. */
const parsons = z.object({
  ...base,
  type: z.literal('parsons'),
  language,
  /** Строки в правильном порядке; отступы сохраняются */
  lines: z.array(z.string()).min(3),
  distractors: z.array(z.string()).default([]),
});

/** Токен-пропуски: код с `___`, пропуски заполняются с «клавиатуры токенов». */
const fillTokens = z.object({
  ...base,
  type: z.literal('fill-tokens'),
  language,
  code: text,
  /** Правильные токены по порядку пропусков */
  tokens: z.array(text).min(1),
  decoys: z.array(text).default([]),
});

/** Порядок: таймлайн событий (render → commit → effect) или шаги «рецепта» решения. */
const order = z.object({
  ...base,
  type: z.literal('order'),
  kind: z.enum(['timeline', 'recipe']),
  /** Шаги в правильном порядке; в уроке показываются перемешанными */
  steps: z.array(text).min(3),
});

/** Выбери инструмент: сценарий → подходящая техника и почему не остальные. */
const chooseTool = z.object({
  ...base,
  type: z.literal('choose-tool'),
  options: z
    .array(z.object({ label: text, why: text }))
    .min(2),
  answer: z.number().int().nonnegative(),
});

/**
 * Карточка с вариантами: альтернатива режиму «объясни своими словами» для вопроса из банка.
 * Варианты — правдоподобные формулировки ответа, неверные построены на типичных заблуждениях;
 * `why` объясняет каждый вариант после ответа.
 */
const quiz = z.object({
  ...base,
  type: z.literal('quiz'),
  question: kebab,
  options: z
    .array(z.object({ label: text, why: text }))
    .min(3)
    .max(5),
  answer: z.number().int().nonnegative(),
});

export const exerciseSchema = z
  .discriminatedUnion('type', [predictOutput, findBug, parsons, fillTokens, order, chooseTool, quiz])
  .superRefine((ex, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message: `${ex.id}: ${message}` });

    if ('answer' in ex) {
      const count = ex.type === 'find-bug' ? ex.causes.length : ex.options.length;
      if (ex.answer >= count) issue(`answer=${ex.answer}, а вариантов ${count}`);
    }
    if ('options' in ex) {
      const labels = ex.options.map((o) => (typeof o === 'string' ? o : o.label));
      if (new Set(labels).size !== labels.length) issue('варианты ответа повторяются');
    }
    if (ex.type === 'find-bug') {
      const lines = ex.code.split('\n').length;
      for (const n of ex.bugLines) if (n > lines) issue(`bugLines содержит ${n}, а в коде ${lines} строк`);
    }
    if (ex.type === 'fill-tokens') {
      const gaps = ex.code.split(GAP).length - 1;
      if (gaps !== ex.tokens.length) issue(`пропусков ${gaps}, а токенов ${ex.tokens.length}`);
      const overlap = ex.decoys.filter((d) => ex.tokens.includes(d));
      if (overlap.length) issue(`ловушки совпадают с ответами: ${overlap.join(', ')}`);
    }
    if (ex.type === 'parsons') {
      const overlap = ex.distractors.filter((d) => ex.lines.includes(d));
      if (overlap.length) issue(`строки-ловушки совпадают с правильными: ${overlap.join(' | ')}`);
    }
  });

export type Exercise = z.output<typeof exerciseSchema>;
export type ExerciseType = Exercise['type'];

/** Разбирает YAML-файл со списком упражнений; при ошибке называет файл и упражнение. */
export function parseExercises(raw: string, source = 'exercises'): Exercise[] {
  const result = z.array(exerciseSchema).safeParse(parseYaml(raw));
  if (!result.success) {
    throw new Error(`${source}: ${z.prettifyError(result.error)}`);
  }
  return result.data;
}
