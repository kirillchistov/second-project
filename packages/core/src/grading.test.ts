import { expect, test } from 'vitest';
import { outcomeFor, scorePoints, verdictFor } from './grading.ts';

const p = (weight: 1 | 2 | 3, status: 'covered' | 'partial' | 'missing') => ({ weight, status });

test('балл — доля веса раскрытых пунктов, частичный пункт — половина', () => {
  expect(scorePoints([p(3, 'covered'), p(2, 'covered'), p(1, 'missing')])).toBe(83);
  expect(scorePoints([p(3, 'partial'), p(1, 'covered')])).toBe(63);
  expect(scorePoints([])).toBe(0);
});

test('без сути ответа «хорошо» не ставится, даже при высоком балле', () => {
  const points = [p(3, 'missing'), p(2, 'covered'), p(2, 'covered'), p(2, 'covered'), p(2, 'covered'), p(2, 'covered')];
  expect(scorePoints(points)).toBeGreaterThanOrEqual(75);
  expect(verdictFor(points, [])).toBe('partial');
});

test('фактическая ошибка снимает «хорошо»', () => {
  const points = [p(3, 'covered'), p(2, 'covered')];
  expect(verdictFor(points, [])).toBe('good');
  expect(verdictFor(points, ['cleanup вызывается только при размонтировании'])).toBe('partial');
});

test('слабый ответ', () => {
  expect(verdictFor([p(3, 'missing'), p(2, 'partial')], [])).toBe('weak');
});

test('подсказка снижает зачёт до «частично»', () => {
  expect(outcomeFor('good', 0)).toBe('good');
  expect(outcomeFor('good', 1)).toBe('hard');
  expect(outcomeFor('partial', 0)).toBe('hard');
  expect(outcomeFor('weak', 0)).toBe('again');
});
