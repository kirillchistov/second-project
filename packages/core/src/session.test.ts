import { expect, test } from 'vitest';
import type { LessonItem } from './path.ts';
import { currentItem, sessionProgress, sessionReducer, startSession, summarize, type SessionAction, type SessionState } from './session.ts';
import { lessonXp, XP } from './progress.ts';

const item = (id: string) => ({ kind: 'card', id, skill: id, question: {} }) as unknown as LessonItem;
const run = (state: SessionState, actions: SessionAction[]) => actions.reduce(sessionReducer, state);

test('урок без ошибок', () => {
  const s = run(startSession([item('a'), item('b')]), [
    { type: 'answer', outcome: 'good' },
    { type: 'continue' },
    { type: 'answer', outcome: 'easy' },
    { type: 'continue' },
  ]);
  expect(s.phase).toBe('done');
  const summary = summarize(s);
  expect(summary).toMatchObject({ total: 2, firstTry: 2, perfect: true, mistakes: [] });
  expect(lessonXp(summary)).toBe(2 * XP.firstTry + XP.lessonComplete + XP.perfectBonus);
});

test('ошибка возвращает задание в конец, в повторение идёт первая попытка', () => {
  let s = run(startSession([item('a'), item('b')]), [{ type: 'answer', outcome: 'again' }]);
  expect(s.phase).toBe('feedback');
  expect(s.last).toEqual({ correct: false, outcome: 'again' });
  expect(s.queue.map((i) => i.id)).toEqual(['a', 'b', 'a']);
  expect(sessionProgress(s)).toBe(0);

  s = run(s, [{ type: 'continue' }, { type: 'answer', outcome: 'good' }, { type: 'continue' }]);
  expect(currentItem(s)?.id).toBe('a');
  expect(sessionProgress(s)).toBe(0.5);

  s = run(s, [{ type: 'answer', outcome: 'good' }, { type: 'continue' }]);
  expect(s.phase).toBe('done');
  expect(s.results.a).toEqual({ first: 'again', attempts: 2, solved: true });
  expect(summarize(s)).toMatchObject({ firstTry: 1, perfect: false, mistakes: ['a'] });
});

test('события вне своей фазы игнорируются', () => {
  const s = startSession([item('a')]);
  expect(sessionReducer(s, { type: 'continue' })).toBe(s);
  const answered = sessionReducer(s, { type: 'answer', outcome: 'good' });
  expect(sessionReducer(answered, { type: 'answer', outcome: 'again' })).toBe(answered);
});

test('пустой урок сразу завершён', () => {
  expect(startSession([]).phase).toBe('done');
  expect(lessonXp(summarize(startSession([])))).toBe(0);
});

test('способ ответа и подсказки сохраняются для первой попытки', () => {
  const s = run(startSession([item('a')]), [
    { type: 'answer', outcome: 'again', meta: { mode: 'voice', hints: 2 } },
    { type: 'continue' },
    { type: 'answer', outcome: 'good', meta: { mode: 'voice', hints: 0 } },
  ]);
  expect(s.results.a).toEqual({ first: 'again', attempts: 2, solved: true, meta: { mode: 'voice', hints: 2 } });
});
