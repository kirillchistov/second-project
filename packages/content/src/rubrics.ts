import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const kebab = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ожидается kebab-case');
const text = z.string().trim().min(1);

/**
 * Рубрика устного ответа на вопрос: проверяемые ключевые пункты с весами и типичные заблуждения.
 * Модель-оценщик отмечает, какие пункты раскрыты, а балл считает код — так оценка воспроизводима.
 */
export const rubricSchema = z
  .object({
    question: kebab,
    points: z
      .array(
        z.object({
          id: kebab,
          text,
          /** 3 — суть ответа, 2 — важная деталь, 1 — плюс к ответу */
          weight: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        }),
      )
      .min(2)
      .max(7),
    /** Частые ошибки в ответах на этот вопрос: если прозвучали — это фактическая ошибка */
    misconceptions: z.array(text).default([]),
  })
  .superRefine((r, ctx) => {
    const ids = r.points.map((p) => p.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: `${r.question}: id пунктов повторяются` });
    if (!r.points.some((p) => p.weight === 3)) ctx.addIssue({ code: 'custom', message: `${r.question}: нет ни одного пункта с весом 3` });
  });

export type Rubric = z.output<typeof rubricSchema>;

export function parseRubrics(raw: string, source = 'rubrics'): Rubric[] {
  const result = z.array(rubricSchema).safeParse(parseYaml(raw));
  if (!result.success) throw new Error(`${source}: ${z.prettifyError(result.error)}`);
  return result.data;
}
