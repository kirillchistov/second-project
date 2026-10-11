import { describe, expect, test } from 'vitest';
import { parseExercises } from '../src/exercises.ts';
import { loadExercises, loadQuestions } from '../src/node.ts';
import {
  applyReviews,
  flatExercise,
  fromFlat,
  generationOutput,
  generatorSystemPrompt,
  generatorUserPrompt,
  renderDraft,
  reviewerUserPrompt,
  uniqueIds,
  validateWire,
  type WireExercise,
} from './generation.ts';

const questions = loadQuestions();
const keys = questions.find((q) => q.slug === 'keys')!;
const examples = loadExercises();

const quiz: WireExercise = {
  id: 'keys-index-quiz',
  type: 'quiz',
  skill: 'list-keys',
  difficulty: 1,
  prompt: 'Чем плох key={index}?',
  explanation: 'Ключ должен быть стабильным.',
  options: [
    { label: 'Состояние переедет к другим элементам', why: 'Верно' },
    { label: 'React выбросит ошибку', why: 'Нет' },
    { label: 'Ничем', why: 'Нет' },
  ],
  answer: 0,
};
const bug: WireExercise = {
  id: 'keys-bug',
  type: 'find-bug',
  skill: 'list-keys',
  difficulty: 5,
  prompt: 'Найди баг',
  explanation: 'Индекс как ключ',
  language: 'tsx',
  code: 'items.map((item, i) => (\n  <Row key={i} item={item} />\n))',
  bugLines: [2],
  causes: ['Индекс как ключ', 'Нет фрагмента'],
  answer: 0,
};

describe('промпты', () => {
  test('системный промпт стабилен и содержит примеры из банка', () => {
    const a = generatorSystemPrompt(examples);
    expect(a).toBe(generatorSystemPrompt(examples));
    expect(a).toContain('effect-cleanup-order');
    expect(a).not.toMatch(/\d{4}-\d{2}-\d{2}/); // никаких дат — иначе кеш промпта не сработает
  });

  test('если quiz уже есть, второй не просим, а существующие упражнения перечисляем', () => {
    const existing = examples.filter((e) => e.question === 'keys');
    const prompt = generatorUserPrompt(keys, existing);
    expect(prompt).toContain(keys.title);
    expect(prompt).toContain('keys-quiz');
    expect(prompt).not.toContain('ровно один quiz');
    expect(generatorUserPrompt(keys, [])).toContain('ровно один quiz');
  });

  test('ревьюеру код find-bug показывается с номерами строк', () => {
    expect(reviewerUserPrompt(keys, [bug])).toContain(' 2 |   <Row key={i} item={item} />');
  });
});

describe('ответ модели', () => {
  test('плоский ответ модели превращается в упражнение своего типа', () => {
    const empty = { language: 'tsx', code: '', options: [], answer: 0, bugLines: [], causes: [], lines: [], distractors: [], tokens: [], decoys: [], kind: 'none', steps: [] } as const;
    const flat = flatExercise.parse({ ...empty, ...bug });
    expect(fromFlat(flat)).toEqual(bug);
    expect(fromFlat(flatExercise.parse({ ...empty, ...quiz }))).toEqual(quiz);
    const predict = fromFlat(
      flatExercise.parse({ ...empty, ...quiz, type: 'predict-output', code: 'console.log(1)', options: [{ label: '1', why: '' }, { label: '2', why: '' }] }),
    );
    expect(predict).toMatchObject({ type: 'predict-output', options: ['1', '2'] });
    expect(() => generationOutput.parse({ exercises: [quiz] })).toThrow(); // плоский формат требует все поля
  });

  test('схема банка отсеивает неверные упражнения', () => {
    const { valid, invalid } = validateWire([quiz, bug, { ...quiz, id: 'broken', answer: 7 }], 'keys');
    expect(valid.map((e) => e.id)).toEqual(['keys-index-quiz', 'keys-bug']);
    expect(valid.every((e) => e.question === 'keys')).toBe(true);
    expect(valid[1].difficulty).toBe(3); // сложность зажимается в 1..3
    expect(invalid).toHaveLength(1);
    expect(invalid[0].id).toBe('broken');
  });

  test('вердикты ревьюера: ok, fix с заменой, drop и пропущенное упражнение', () => {
    const fixedQuiz = { ...quiz, id: 'renamed-by-model', prompt: 'Исправленный вопрос' };
    const { kept, notes, dropped } = applyReviews(
      [quiz, bug, { ...quiz, id: 'unreviewed' }],
      [
        { id: 'keys-index-quiz', verdict: 'fix', issues: ['неоднозначно'], fixed: fixedQuiz },
        { id: 'keys-bug', verdict: 'drop', issues: ['спорно'], fixed: null },
      ],
    );
    expect(kept.map((e) => e.id)).toEqual(['keys-index-quiz', 'unreviewed']);
    expect(kept[0].prompt).toBe('Исправленный вопрос'); // id сохраняется исходный
    expect(dropped).toEqual(['keys-bug']);
    expect(notes.get('keys-index-quiz')).toEqual(['исправлено ревьюером:', 'неоднозначно']);
    expect(notes.get('unreviewed')?.[0]).toMatch(/не проверил/);
  });

  test('id делаются уникальными относительно банка', () => {
    const items = uniqueIds([{ id: 'a' }, { id: 'a' }, { id: 'b' }], new Set(['a']));
    expect(items.map((i) => i.id)).toEqual(['a-2', 'a-3', 'b']);
  });
});

test('черновик — валидный YAML банка с комментариями для вычитки', () => {
  const { valid } = validateWire([quiz, bug], 'keys');
  const text = renderDraft({
    question: keys,
    exercises: valid,
    notes: new Map([['keys-bug', ['замечания:', 'проверить номер строки']]]),
    dropped: ['keys-extra'],
    model: 'claude-opus-5-5',
    date: '2026-10-11',
  });
  expect(text).toContain('# Отброшено ревьюером: keys-extra');
  expect(text).toContain('# проверить номер строки');
  expect(parseExercises(text, 'draft').map((e) => e.id)).toEqual(['keys-index-quiz', 'keys-bug']);
});
