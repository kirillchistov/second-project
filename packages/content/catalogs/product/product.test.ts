import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { loadExercises, loadQuestions } from '../../src/node.ts';
import { PRODUCT_CATALOG } from './catalog.ts';

const ROOT = join(import.meta.dirname);
const QUESTIONS = loadQuestions(join(ROOT, 'questions'), PRODUCT_CATALOG.levels.map((level) => level.id));
const EXERCISES = loadExercises(join(ROOT, 'exercises'));
const REACT = loadQuestions();

describe('продуктовый каталог', () => {
  test('короткий путь из четырёх шаблонов и своего уровня, не из грейдов React', () => {
    expect(QUESTIONS.map((q) => q.slug)).toEqual([
      'problem-brief',
      'opportunity-tree',
      'one-pager',
      'experiment-card',
    ]);
    expect(new Set(QUESTIONS.map((q) => q.level))).toEqual(new Set(['practice']));
    expect(QUESTIONS.some((q) => q.level === 'junior' || q.level === 'middle' || q.level === 'senior')).toBe(false);
    const topics = new Set(PRODUCT_CATALOG.topics.map((topic) => topic.id));
    for (const question of QUESTIONS) expect(topics).toContain(question.topic);
  });

  test('в каждом вопросе есть копируемый шаблон и квиз', () => {
    for (const question of QUESTIONS) {
      expect(question.short.length, question.slug).toBeGreaterThan(40);
      expect(question.body.length, question.slug).toBeGreaterThan(200);
      expect(question.body, question.slug).toMatch(/```text[\s\S]+```/);
      expect(question.links.length, question.slug).toBeGreaterThan(0);
    }
    const quizzes = EXERCISES.filter((exercise) => exercise.type === 'quiz');
    expect(quizzes.map((quiz) => quiz.question).sort()).toEqual(QUESTIONS.map((q) => q.slug).sort());
    for (const quiz of quizzes) expect(quiz.skill.startsWith('product-'), quiz.id).toBe(true);
  });

  test('эти вопросы не попадают в React-банк', () => {
    const slugs = new Set(REACT.map((q) => q.slug));
    for (const question of QUESTIONS) expect(slugs.has(question.slug)).toBe(false);
    expect(REACT).toHaveLength(224);
  });
});
