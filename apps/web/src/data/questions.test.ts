import { expect, test } from 'vitest';
import { QUESTIONS, searchQuestions } from './questions';

test('вопросы загружаются через import.meta.glob', () => {
  expect(QUESTIONS).toHaveLength(140);
});

test('поиск ставит совпадения в заголовке первыми', () => {
  expect(searchQuestions('гидрац').slice(0, 2).map((q) => q.slug)).toEqual(['streaming-ssr', 'hydration-mismatch']);
  expect(searchQuestions('42')[0].number).toBe(42);
});
