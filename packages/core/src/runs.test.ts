import { describe, expect, test } from 'vitest';
import { XP } from './progress.ts';
import { foldRuns, runFromSession, runXp, type LessonRun } from './runs.ts';
import { review } from './srs.ts';
import type { SessionState } from './session.ts';

const skillOf = (id: string) => (id.startsWith('gone:') ? undefined : `s:${id}`);

function run(id: string, completedAt: string, results: LessonRun['results'], lessonId: string | null = 'core-1'): LessonRun {
  return { id, lessonId, day: completedAt.slice(0, 10), completedAt, results };
}

describe('прогоны уроков', () => {
  test('прогон из сессии сохраняет первую попытку, число попыток и способ ответа', () => {
    const session = {
      results: {
        a: { first: 'good', attempts: 1, solved: true },
        b: { first: 'again', attempts: 2, solved: true, meta: { mode: 'voice', hints: 1 } },
      },
    } as unknown as SessionState;
    const r = runFromSession(session, { id: 'r1', lessonId: 'core-1', day: '2026-10-15', completedAt: '2026-10-15T10:00:00.000Z' });
    expect(r.results).toEqual([
      { itemId: 'a', first: 'good', attempts: 1 },
      { itemId: 'b', first: 'again', attempts: 2, mode: 'voice', hints: 1 },
    ]);
    expect(runXp(r)).toBe(XP.firstTry + XP.afterMistake + XP.lessonComplete);
  });

  test('сборка истории: карточки, backlog, XP по дням и лучшая точность урока', () => {
    const r1 = run('r1', '2026-10-14T10:00:00.000Z', [
      { itemId: 'a', first: 'again', attempts: 2 },
      { itemId: 'b', first: 'good', attempts: 1 },
      { itemId: 'gone:x', first: 'again', attempts: 1 },
    ]);
    const r2 = run('r2', '2026-10-15T09:00:00.000Z', [{ itemId: 'a', first: 'good', attempts: 1 }], null);
    const folded = foldRuns([r2, r1], skillOf);

    expect(folded.backlog).toEqual([]); // ошибку по «a» закрыли в повторении
    expect(folded.cards['s:a']).toEqual(review(review(undefined, 'again', new Date(r1.completedAt)), 'good', new Date(r2.completedAt)));
    expect(Object.keys(folded.cards).sort()).toEqual(['s:a', 's:b']);
    expect(folded.activity).toEqual({ '2026-10-14': runXp(r1), '2026-10-15': runXp(r2) });
    expect(folded.lessonsDone).toEqual({ 'core-1': 1 / 3 });
  });

  test('результат не зависит от порядка прихода прогонов', () => {
    const runs = [
      run('r1', '2026-10-14T10:00:00.000Z', [{ itemId: 'a', first: 'again', attempts: 2 }]),
      run('r2', '2026-10-14T11:00:00.000Z', [{ itemId: 'b', first: 'again', attempts: 2 }]),
      run('r3', '2026-10-14T11:00:00.000Z', [{ itemId: 'a', first: 'easy', attempts: 1 }]),
    ];
    expect(foldRuns([...runs].reverse(), skillOf)).toEqual(foldRuns(runs, skillOf));
    expect(foldRuns(runs, skillOf).backlog).toEqual(['b']);
  });
});
