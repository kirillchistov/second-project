import { ITEMS } from '@/lib/content';
import { lessonXp, localDay, review, summarize, type SessionState, type StoredCard } from '@rr/core';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

/**
 * Локальная база — источник правды о прогрессе (local-first): всё работает офлайн,
 * синхронизация с сервером появится в фазе 2 поверх этих же таблиц.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE skill_cards (skill TEXT PRIMARY KEY NOT NULL, card TEXT NOT NULL);
  CREATE TABLE backlog (item_id TEXT PRIMARY KEY NOT NULL, added_at TEXT NOT NULL);
  CREATE TABLE lessons_done (lesson_id TEXT PRIMARY KEY NOT NULL, completed_at TEXT NOT NULL, best_accuracy REAL NOT NULL);
  CREATE TABLE activity (day TEXT PRIMARY KEY NOT NULL, xp INTEGER NOT NULL);
  CREATE TABLE attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    outcome TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    lesson_id TEXT,
    at TEXT NOT NULL
  );
  `,
  // Фаза 2: способ ответа на карточку и число подсказок — для метрики «без подсказок»
  `
  ALTER TABLE attempts ADD COLUMN mode TEXT;
  ALTER TABLE attempts ADD COLUMN hints INTEGER NOT NULL DEFAULT 0;
  `,
];

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
    version++;
  }
}

let database: Promise<SQLiteDatabase> | null = null;

/**
 * Единственное соединение с базой на всё время жизни приложения: открывается и мигрирует один раз
 * и никогда не закрывается. SQLiteProvider закрывает базу при размонтировании и при смене onInit —
 * после Fast Refresh это рвало соединение под незавершёнными запросами («Access to closed resource»).
 */
export function getDatabase(): Promise<SQLiteDatabase> {
  database ??= openDatabaseAsync('progress.db').then(async (db) => {
    await migrate(db);
    return db;
  });
  return database;
}

export interface ProgressSnapshot {
  cards: Map<string, StoredCard>;
  backlog: string[];
  /** день `YYYY-MM-DD` → XP */
  activity: Map<string, number>;
  /** id урока → лучшая точность */
  lessonsDone: Map<string, number>;
  /** Ответы голосом с проверкой ИИ: сколько всего и сколько без единой подсказки */
  voice: { answers: number; withoutHints: number };
}

export async function loadProgress(db: SQLiteDatabase): Promise<ProgressSnapshot> {
  const [cards, backlog, activity, lessons, voice] = await Promise.all([
    db.getAllAsync<{ skill: string; card: string }>('SELECT skill, card FROM skill_cards'),
    db.getAllAsync<{ item_id: string }>('SELECT item_id FROM backlog ORDER BY added_at'),
    db.getAllAsync<{ day: string; xp: number }>('SELECT day, xp FROM activity'),
    db.getAllAsync<{ lesson_id: string; best_accuracy: number }>('SELECT lesson_id, best_accuracy FROM lessons_done'),
    db.getFirstAsync<{ answers: number; withoutHints: number | null }>(
      "SELECT COUNT(*) AS answers, SUM(hints = 0) AS withoutHints FROM attempts WHERE mode = 'voice'",
    ),
  ]);
  return {
    cards: new Map(cards.map((r) => [r.skill, JSON.parse(r.card) as StoredCard])),
    backlog: backlog.map((r) => r.item_id),
    activity: new Map(activity.map((r) => [r.day, r.xp])),
    lessonsDone: new Map(lessons.map((r) => [r.lesson_id, r.best_accuracy])),
    voice: { answers: voice?.answers ?? 0, withoutHints: voice?.withoutHints ?? 0 },
  };
}

export interface SavedLesson {
  xp: number;
  accuracy: number;
  perfect: boolean;
}

/**
 * Сохраняет завершённый урок одной транзакцией:
 * первая попытка каждого задания двигает карточку навыка, ошибки попадают в Bug Backlog,
 * решённые с первого раза — уходят из него, XP засчитывается в сегодняшний день.
 */
export async function saveSession(
  db: SQLiteDatabase,
  session: SessionState,
  lessonId: string | null,
  now: Date,
): Promise<SavedLesson> {
  const summary = summarize(session);
  const xp = lessonXp(summary);
  const at = now.toISOString();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [itemId, result] of Object.entries(session.results)) {
      const item = ITEMS.get(itemId);
      if (!item) continue;
      const row = await txn.getFirstAsync<{ card: string }>('SELECT card FROM skill_cards WHERE skill = ?', item.skill);
      const card = review(row ? (JSON.parse(row.card) as StoredCard) : undefined, result.first, now);
      await txn.runAsync(
        'INSERT INTO skill_cards (skill, card) VALUES (?, ?) ON CONFLICT(skill) DO UPDATE SET card = excluded.card',
        item.skill,
        JSON.stringify(card),
      );
      await txn.runAsync(
        'INSERT INTO attempts (item_id, skill, outcome, attempts, lesson_id, at, mode, hints) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        itemId,
        item.skill,
        result.first,
        result.attempts,
        lessonId,
        at,
        result.meta?.mode ?? null,
        result.meta?.hints ?? 0,
      );
      if (result.first === 'again') {
        await txn.runAsync('INSERT OR IGNORE INTO backlog (item_id, added_at) VALUES (?, ?)', itemId, at);
      } else {
        await txn.runAsync('DELETE FROM backlog WHERE item_id = ?', itemId);
      }
    }

    await txn.runAsync(
      'INSERT INTO activity (day, xp) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET xp = xp + excluded.xp',
      localDay(now),
      xp,
    );

    if (lessonId) {
      await txn.runAsync(
        `INSERT INTO lessons_done (lesson_id, completed_at, best_accuracy) VALUES (?, ?, ?)
         ON CONFLICT(lesson_id) DO UPDATE SET best_accuracy = MAX(best_accuracy, excluded.best_accuracy)`,
        lessonId,
        at,
        summary.accuracy,
      );
    }
  });

  return { xp, accuracy: summary.accuracy, perfect: summary.perfect };
}
