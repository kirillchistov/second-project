import { ITEMS } from '@/lib/content';
import { foldRuns, localDay, runXp, type LessonRun, type Outcome, type RunResult } from '@rr/core';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Прогоны уроков в SQLite — то, что уходит на сервер и приходит с других устройств.
 * Производные таблицы (карточки навыков, backlog, XP по дням, пройденные уроки) собираются из прогонов
 * функцией foldRuns из @rr/core — той же, что и на сервере. Бонусный XP за квесты локальный и лежит отдельно.
 */

type Executor = Pick<SQLiteDatabase, 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

interface RunRow {
  id: string;
  lesson_id: string | null;
  day: string;
  completed_at: string;
  results: string;
}

function fromRow(r: RunRow): LessonRun {
  return { id: r.id, lessonId: r.lesson_id, day: r.day, completedAt: r.completed_at, results: JSON.parse(r.results) as RunResult[] };
}

export async function insertRun(db: Executor, run: LessonRun, synced: boolean): Promise<boolean> {
  const res = await db.runAsync(
    'INSERT OR IGNORE INTO runs (id, lesson_id, day, completed_at, results, synced) VALUES (?, ?, ?, ?, ?, ?)',
    run.id,
    run.lessonId,
    run.day,
    run.completedAt,
    JSON.stringify(run.results),
    synced ? 1 : 0,
  );
  return res.changes > 0;
}

/**
 * Миграция 4: прогресс, накопленный до появления прогонов, восстанавливается из журнала попыток.
 * Каждое сохранение урока писало попытки с одним временем `at` — по нему и группируем.
 * Разница между XP дня и XP прогонов — награды за квесты: она уходит в bonus_xp.
 */
export async function backfillRuns(db: Executor): Promise<void> {
  const attempts = await db.getAllAsync<{
    item_id: string;
    outcome: Outcome;
    attempts: number;
    lesson_id: string | null;
    at: string;
    mode: RunResult['mode'] | null;
    hints: number;
  }>('SELECT item_id, outcome, attempts, lesson_id, at, mode, hints FROM attempts ORDER BY id');

  const groups = new Map<string, LessonRun>();
  for (const a of attempts) {
    const key = `${a.at}|${a.lesson_id ?? ''}`;
    let run = groups.get(key);
    if (!run) {
      run = { id: `legacy-${a.at}-${a.lesson_id ?? 'review'}`, lessonId: a.lesson_id, day: localDay(new Date(a.at)), completedAt: a.at, results: [] };
      groups.set(key, run);
    }
    run.results.push({ itemId: a.item_id, first: a.outcome, attempts: a.attempts, ...(a.mode ? { mode: a.mode, hints: a.hints } : {}) });
  }

  const runXpByDay = new Map<string, number>();
  for (const run of groups.values()) {
    await insertRun(db, run, false);
    runXpByDay.set(run.day, (runXpByDay.get(run.day) ?? 0) + runXp(run));
  }
  const activity = await db.getAllAsync<{ day: string; xp: number }>('SELECT day, xp FROM activity');
  for (const { day, xp } of activity) {
    const bonus = xp - (runXpByDay.get(day) ?? 0);
    if (bonus > 0) await db.runAsync('INSERT OR REPLACE INTO bonus_xp (day, xp) VALUES (?, ?)', day, bonus);
  }
}

export async function unsyncedRuns(db: Executor, limit = 200): Promise<LessonRun[]> {
  const rows = await db.getAllAsync<RunRow>(
    'SELECT id, lesson_id, day, completed_at, results FROM runs WHERE synced = 0 ORDER BY completed_at LIMIT ?',
    limit,
  );
  return rows.map(fromRow);
}

export async function markSynced(db: Executor, ids: readonly string[]): Promise<void> {
  for (const id of ids) await db.runAsync('UPDATE runs SET synced = 1 WHERE id = ?', id);
}

/**
 * Прогоны с сервера: новые (с других устройств) добавляются вместе с попытками для статистики.
 * Возвращает, сколько прогонов оказались новыми, — если ноль, пересобирать прогресс не нужно.
 */
export async function importRuns(db: Executor, remote: readonly LessonRun[]): Promise<number> {
  let added = 0;
  for (const run of remote) {
    if (!(await insertRun(db, run, true))) continue;
    added++;
    for (const r of run.results) {
      await db.runAsync(
        'INSERT INTO attempts (item_id, skill, outcome, attempts, lesson_id, at, mode, hints) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        r.itemId,
        ITEMS.get(r.itemId)?.skill ?? '',
        r.first,
        r.attempts,
        run.lessonId,
        run.completedAt,
        r.mode ?? null,
        r.hints ?? 0,
      );
    }
  }
  return added;
}

/** Пересборка производных таблиц из всех прогонов — после того, как пришли прогоны с другого устройства */
export async function rebuildFromRuns(db: Executor): Promise<void> {
  const rows = await db.getAllAsync<RunRow>('SELECT id, lesson_id, day, completed_at, results FROM runs');
  const folded = foldRuns(rows.map(fromRow), (itemId) => ITEMS.get(itemId)?.skill);
  const bonus = await db.getAllAsync<{ day: string; xp: number }>('SELECT day, xp FROM bonus_xp');

  await db.runAsync('DELETE FROM skill_cards');
  for (const [skill, card] of Object.entries(folded.cards)) {
    await db.runAsync('INSERT INTO skill_cards (skill, card) VALUES (?, ?)', skill, JSON.stringify(card));
  }
  await db.runAsync('DELETE FROM backlog');
  for (const itemId of folded.backlog) {
    await db.runAsync('INSERT INTO backlog (item_id, added_at) VALUES (?, ?)', itemId, folded.backlogSince[itemId]);
  }
  const activity = new Map(Object.entries(folded.activity));
  for (const b of bonus) activity.set(b.day, (activity.get(b.day) ?? 0) + b.xp);
  await db.runAsync('DELETE FROM activity');
  for (const [day, xp] of activity) await db.runAsync('INSERT INTO activity (day, xp) VALUES (?, ?)', day, xp);
  await db.runAsync('DELETE FROM lessons_done');
  const lastByLesson = new Map<string, string>();
  for (const r of rows) if (r.lesson_id) lastByLesson.set(r.lesson_id, r.completed_at);
  for (const [lessonId, accuracy] of Object.entries(folded.lessonsDone)) {
    await db.runAsync(
      'INSERT INTO lessons_done (lesson_id, completed_at, best_accuracy) VALUES (?, ?, ?)',
      lessonId,
      lastByLesson.get(lessonId) ?? new Date().toISOString(),
      accuracy,
    );
  }
}

/** Очистка прогресса на устройстве — перед входом в другой аккаунт: прежний прогресс уже на сервере */
export async function resetLocalProgress(db: Executor): Promise<void> {
  for (const table of ['runs', 'attempts', 'skill_cards', 'backlog', 'activity', 'lessons_done', 'bonus_xp', 'day_stats', 'quests', 'stash_days']) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
}
