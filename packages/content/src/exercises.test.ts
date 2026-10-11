import { describe, expect, test } from 'vitest';
import { exerciseSchema, parseExercises } from './exercises.ts';
import { loadDraftFiles, loadExercises, loadQuestions } from './node.ts';

const EXERCISES = loadExercises();
const slugs = new Set(loadQuestions().map((q) => q.slug));

describe('банк упражнений', () => {
  test('id уникальны', () => {
    const ids = EXERCISES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('ссылки на вопросы ведут на существующие вопросы', () => {
    for (const e of EXERCISES) if (e.question) expect(slugs, e.id).toContain(e.question);
  });

  test('черновики проходят схему, называются по вопросу и не пересекаются с банком по id', () => {
    const bank = new Set(EXERCISES.map((e) => e.id));
    for (const [slug, drafts] of loadDraftFiles()) {
      expect(slugs, `drafts/${slug}.yaml`).toContain(slug);
      for (const e of drafts) {
        expect(e.question, e.id).toBe(slug);
        expect(bank.has(e.id), e.id).toBe(false);
      }
    }
  });

  test('есть хотя бы по одному упражнению каждого типа', () => {
    const types = new Set(EXERCISES.map((e) => e.type));
    expect([...types].sort()).toEqual(['choose-tool', 'fill-tokens', 'find-bug', 'order', 'parsons', 'predict-output', 'quiz']);
  });
});

describe('схема упражнения', () => {
  const choose = {
    id: 'x',
    type: 'choose-tool',
    skill: 's',
    prompt: 'p',
    explanation: 'e',
    options: [
      { label: 'a', why: 'a' },
      { label: 'b', why: 'b' },
    ],
    answer: 0,
  };

  test('подставляет значения по умолчанию', () => {
    expect(exerciseSchema.parse(choose).difficulty).toBe(1);
  });

  test('ответ должен указывать на существующий вариант', () => {
    expect(exerciseSchema.safeParse({ ...choose, answer: 2 }).success).toBe(false);
  });

  test('число пропусков совпадает с числом токенов', () => {
    const fill = { ...choose, type: 'fill-tokens', code: 'a(___, ___)', tokens: ['x'], options: undefined, answer: undefined };
    expect(exerciseSchema.safeParse(fill).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...fill, tokens: ['x', 'y'] }).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...fill, tokens: ['x', 'y'], decoys: ['y'] }).success).toBe(false);
  });

  test('строка с багом существует в коде', () => {
    const bug = { ...choose, type: 'find-bug', code: 'a\nb', bugLines: [3], causes: ['a', 'b'], options: undefined };
    expect(exerciseSchema.safeParse(bug).success).toBe(false);
  });

  test('quiz привязан к вопросу, вариантов 3–5, без повторов', () => {
    const quiz = { ...choose, type: 'quiz', question: 'keys', options: [...choose.options, { label: 'c', why: 'c' }] };
    expect(exerciseSchema.safeParse(quiz).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...quiz, question: undefined }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...quiz, options: choose.options }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...quiz, options: [...choose.options, choose.options[0]] }).success).toBe(false);
  });

  test('ошибка разбора называет файл и упражнение', () => {
    expect(() => parseExercises('- id: broken\n  type: order\n', 'bad.yaml')).toThrow(/bad\.yaml/);
  });
});
