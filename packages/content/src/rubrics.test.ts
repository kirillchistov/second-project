import { describe, expect, test } from 'vitest';
import { loadQuestions, loadRubrics } from './node.ts';
import { rubricSchema } from './rubrics.ts';

const questions = loadQuestions();
const rubrics = loadRubrics();

describe('рубрики устных ответов', () => {
  test('у каждого вопроса ровно одна рубрика', () => {
    const slugs = rubrics.map((r) => r.question);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.sort()).toEqual(questions.map((q) => q.slug).sort());
  });

  test('в рубрике 2–7 пунктов, есть суть (вес 3), id пунктов уникальны', () => {
    const base = { question: 'keys', misconceptions: [] };
    const point = (id: string, weight: 1 | 2 | 3) => ({ id, text: id, weight });
    expect(rubricSchema.safeParse({ ...base, points: [point('a', 3), point('b', 1)] }).success).toBe(true);
    expect(rubricSchema.safeParse({ ...base, points: [point('a', 2), point('b', 1)] }).success).toBe(false);
    expect(rubricSchema.safeParse({ ...base, points: [point('a', 3), point('a', 1)] }).success).toBe(false);
    expect(rubricSchema.safeParse({ ...base, points: [point('a', 3)] }).success).toBe(false);
  });
});
