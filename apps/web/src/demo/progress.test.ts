import { expect, test } from 'vitest';
import { applySession, emptyProgress, type DemoProgress } from './progress';
import type { SessionState } from '@rr/core';

const now = new Date(2026, 9, 12, 15, 0, 0);

function session(results: SessionState['results']): SessionState {
  return { queue: [], position: 0, phase: 'done', results, combo: 0 };
}

const skillOf = (id: string) => (id === 'missing' ? undefined : `skill:${id}`);

test('верный ответ с первой попытки даёт XP, карточку навыка и урок', () => {
  const { progress, saved } = applySession(
    emptyProgress(),
    session({ a: { first: 'good', attempts: 1, solved: true } }),
    'core-1',
    now,
    skillOf,
  );
  expect(saved).toEqual({ xp: 25, accuracy: 1, perfect: true });
  expect(progress.activity['2026-10-12']).toBe(25);
  expect(progress.lessonsDone['core-1']).toBe(1);
  expect(progress.cards['skill:a']).toBeDefined();
  expect(progress.backlog).toEqual([]);
});

test('ошибка попадает в backlog, повторный успех убирает её и не понижает точность урока', () => {
  const failed = applySession(
    emptyProgress(),
    session({ a: { first: 'again', attempts: 2, solved: true } }),
    'core-1',
    now,
    skillOf,
  );
  expect(failed.saved.xp).toBe(8);
  expect(failed.saved.perfect).toBe(false);
  expect(failed.progress.backlog).toEqual(['a']);
  expect(failed.progress.lessonsDone['core-1']).toBe(0);

  const fixed = applySession(
    failed.progress,
    session({ a: { first: 'good', attempts: 1, solved: true } }),
    'core-1',
    now,
    skillOf,
  );
  expect(fixed.progress.backlog).toEqual([]);
  expect(fixed.progress.lessonsDone['core-1']).toBe(1);
  expect(fixed.progress.activity['2026-10-12']).toBe(failed.saved.xp + fixed.saved.xp);
});

test('неизвестный элемент не двигает карточки, лучшая точность не уменьшается', () => {
  const start: DemoProgress = {
    ...emptyProgress(),
    lessonsDone: { 'core-1': 1 },
  };
  const { progress } = applySession(
    start,
    session({ missing: { first: 'again', attempts: 1, solved: false } }),
    'core-1',
    now,
    skillOf,
  );
  expect(progress.cards).toEqual({});
  expect(progress.backlog).toEqual([]);
  expect(progress.lessonsDone['core-1']).toBe(1);
});
