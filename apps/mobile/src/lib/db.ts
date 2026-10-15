import { ITEMS } from '@/lib/content';
import {
  CHEST_XP,
  dueCount,
  EMPTY_DAY,
  lessonXp,
  localDay,
  planFreezes,
  pickQuests,
  QUEST_XP,
  questFrom,
  questProgress,
  review,
  runFromSession,
  sessionDayStats,
  STASH_MAX,
  summarize,
  type DayStats,
  type Quest,
  type QuestProgress,
  type SessionState,
  type StoredCard,
} from '@rr/core';
import { backfillRuns, insertRun } from '@/lib/runs';
import { randomUUID } from 'expo-crypto';
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
  // Фаза 3: статистика дня для квестов, квесты дня, заморозки стрика
  `
  CREATE TABLE day_stats (
    day TEXT PRIMARY KEY NOT NULL,
    answered INTEGER NOT NULL DEFAULT 0,
    first_try INTEGER NOT NULL DEFAULT 0,
    backlog_closed INTEGER NOT NULL DEFAULT 0,
    perfect_lessons INTEGER NOT NULL DEFAULT 0,
    reviews INTEGER NOT NULL DEFAULT 0,
    explained INTEGER NOT NULL DEFAULT 0,
    voice_no_hints INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE quests (
    day TEXT NOT NULL,
    quest_id TEXT NOT NULL,
    target INTEGER NOT NULL,
    claimed_at TEXT,
    PRIMARY KEY (day, quest_id)
  );
  CREATE TABLE stash_days (day TEXT PRIMARY KEY NOT NULL, used_at TEXT NOT NULL);
  CREATE TABLE inventory (item TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL);
  INSERT INTO inventory (item, count) VALUES ('stash', 1);
  `,
  // Аккаунты: прогоны — единица синхронизации с сервером; бонусный XP за квесты — локальный, отдельно
  `
  CREATE TABLE runs (
    id TEXT PRIMARY KEY NOT NULL,
    lesson_id TEXT,
    day TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    results TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX runs_unsynced ON runs (synced);
  CREATE TABLE bonus_xp (day TEXT PRIMARY KEY NOT NULL, xp INTEGER NOT NULL);
  `,
];

/** Шаги миграций, которые нельзя выразить SQL: номер миграции → функция внутри той же транзакции */
const MIGRATION_STEPS: Record<number, (db: SQLiteDatabase) => Promise<void>> = {
  3: backfillRuns,
};

async function migrate(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  while (version < MIGRATIONS.length) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await MIGRATION_STEPS[version]?.(txn);
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
  /** id урока → лучшая точность (статистика; пройденность урока считается по вопросам) */
  lessonsDone: Map<string, number>;
  /** Ответы голосом с проверкой ИИ: сколько всего и сколько без единой подсказки */
  voice: { answers: number; withoutHints: number };
  /** Дни, закрытые заморозкой (`git stash`) */
  frozenDays: Set<string>;
  /** Заморозок в запасе */
  stash: number;
  /** Квесты сегодняшнего дня с прогрессом */
  quests: QuestProgress[];
}

const DAY_COLUMNS = {
  answered: 'answered',
  firstTry: 'first_try',
  backlogClosed: 'backlog_closed',
  perfectLessons: 'perfect_lessons',
  reviews: 'reviews',
  explained: 'explained',
  voiceNoHints: 'voice_no_hints',
} as const satisfies Record<Exclude<keyof DayStats, 'xp'>, string>;

async function dayStats(db: SQLiteDatabase, day: string): Promise<DayStats> {
  const row = await db.getFirstAsync<Record<string, number>>('SELECT * FROM day_stats WHERE day = ?', day);
  const xp = await db.getFirstAsync<{ xp: number }>('SELECT xp FROM activity WHERE day = ?', day);
  const stats: DayStats = { ...EMPTY_DAY, xp: xp?.xp ?? 0 };
  for (const [key, column] of Object.entries(DAY_COLUMNS)) stats[key as keyof typeof DAY_COLUMNS] = row?.[column] ?? 0;
  return stats;
}

async function todayQuests(db: SQLiteDatabase, day: string): Promise<{ quest: Quest; claimed: boolean }[]> {
  const rows = await db.getAllAsync<{ quest_id: string; target: number; claimed_at: string | null }>(
    'SELECT quest_id, target, claimed_at FROM quests WHERE day = ? ORDER BY rowid',
    day,
  );
  return rows.flatMap((r) => {
    const quest = questFrom(r.quest_id, r.target);
    return quest ? [{ quest, claimed: r.claimed_at !== null }] : [];
  });
}

async function stashCount(db: SQLiteDatabase): Promise<number> {
  return (await db.getFirstAsync<{ count: number }>("SELECT count FROM inventory WHERE item = 'stash'"))?.count ?? 0;
}

/**
 * Начало дня: закрыть пропущенные дни заморозками, если их хватает, и выбрать квесты на сегодня.
 * Вызывается при каждой загрузке прогресса — повторный вызов в тот же день ничего не меняет.
 */
export async function startDay(db: SQLiteDatabase, now: Date): Promise<void> {
  const today = localDay(now);
  const [activity, frozen, cards, backlog, voice] = await Promise.all([
    db.getAllAsync<{ day: string }>('SELECT day FROM activity'),
    db.getAllAsync<{ day: string }>('SELECT day FROM stash_days'),
    db.getAllAsync<{ card: string }>('SELECT card FROM skill_cards'),
    db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM backlog'),
    db.getFirstAsync<{ n: number }>("SELECT COUNT(*) AS n FROM attempts WHERE mode = 'voice'"),
  ]);
  const freeze = planFreezes({
    activeDays: activity.map((r) => r.day),
    frozenDays: frozen.map((r) => r.day),
    today,
    available: await stashCount(db),
  });
  const quests = pickQuests(today, {
    backlog: backlog?.n ?? 0,
    due: dueCount(new Map(cards.map((r, i) => [String(i), JSON.parse(r.card) as StoredCard])), now),
    usesVoice: (voice?.n ?? 0) > 0,
  });

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const day of freeze) {
      await txn.runAsync('INSERT OR IGNORE INTO stash_days (day, used_at) VALUES (?, ?)', day, now.toISOString());
    }
    if (freeze.length) await txn.runAsync("UPDATE inventory SET count = count - ? WHERE item = 'stash'", freeze.length);
    // Квесты выбираются один раз за день: OR IGNORE оставляет уже выбранные
    const chosen = await txn.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM quests WHERE day = ?', today);
    if (!chosen?.n) {
      for (const q of quests) {
        await txn.runAsync('INSERT OR IGNORE INTO quests (day, quest_id, target) VALUES (?, ?, ?)', today, q.id, q.target);
      }
    }
  });
}

export async function loadProgress(db: SQLiteDatabase, now: Date): Promise<ProgressSnapshot> {
  const today = localDay(now);
  const [cards, backlog, activity, lessons, voice, frozen, stash, quests, stats] = await Promise.all([
    db.getAllAsync<{ skill: string; card: string }>('SELECT skill, card FROM skill_cards'),
    db.getAllAsync<{ item_id: string }>('SELECT item_id FROM backlog ORDER BY added_at'),
    db.getAllAsync<{ day: string; xp: number }>('SELECT day, xp FROM activity'),
    db.getAllAsync<{ lesson_id: string; best_accuracy: number }>('SELECT lesson_id, best_accuracy FROM lessons_done'),
    db.getFirstAsync<{ answers: number; withoutHints: number | null }>(
      "SELECT COUNT(*) AS answers, SUM(hints = 0) AS withoutHints FROM attempts WHERE mode = 'voice'",
    ),
    db.getAllAsync<{ day: string }>('SELECT day FROM stash_days'),
    stashCount(db),
    todayQuests(db, today),
    dayStats(db, today),
  ]);
  return {
    cards: new Map(cards.map((r) => [r.skill, JSON.parse(r.card) as StoredCard])),
    backlog: backlog.map((r) => r.item_id),
    activity: new Map(activity.map((r) => [r.day, r.xp])),
    lessonsDone: new Map(lessons.map((r) => [r.lesson_id, r.best_accuracy])),
    voice: { answers: voice?.answers ?? 0, withoutHints: voice?.withoutHints ?? 0 },
    frozenDays: new Set(frozen.map((r) => r.day)),
    stash,
    quests: quests.map(({ quest }) => questProgress(quest, stats)),
  };
}

export interface SavedLesson {
  xp: number;
  accuracy: number;
  perfect: boolean;
  /** Квесты, выполненные этой сессией; XP за них уже в `xp` */
  quests: QuestProgress[];
  /** Все квесты дня выполнены: сундук с заморозкой или, если запас полон, с XP */
  chest?: 'stash' | 'xp';
}

/**
 * Сохраняет завершённый урок одной транзакцией:
 * первая попытка каждого задания двигает карточку навыка, ошибки попадают в Bug Backlog,
 * решённые с первого раза — уходят из него, XP засчитывается в сегодняшний день.
 * Затем копится статистика дня и выдаются награды за выполненные квесты.
 */
export async function saveSession(
  db: SQLiteDatabase,
  session: SessionState,
  lessonId: string | null,
  now: Date,
): Promise<SavedLesson> {
  const summary = summarize(session);
  const lesson = lessonXp(summary);
  const at = now.toISOString();
  const today = localDay(now);
  let xp = lesson;
  const completed: QuestProgress[] = [];
  let chest: SavedLesson['chest'];

  await db.withExclusiveTransactionAsync(async (txn) => {
    let backlogClosed = 0;
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
        const removed = await txn.runAsync('DELETE FROM backlog WHERE item_id = ?', itemId);
        backlogClosed += removed.changes;
      }
    }

    // Прогон — для синхронизации с сервером; уйдёт при следующей синхронизации
    await insertRun(txn, runFromSession(session, { id: randomUUID(), lessonId, day: today, completedAt: at }), false);

    if (lessonId) {
      await txn.runAsync(
        `INSERT INTO lessons_done (lesson_id, completed_at, best_accuracy) VALUES (?, ?, ?)
         ON CONFLICT(lesson_id) DO UPDATE SET best_accuracy = MAX(best_accuracy, excluded.best_accuracy)`,
        lessonId,
        at,
        summary.accuracy,
      );
    }

    // Статистика дня для квестов
    const add = { ...sessionDayStats(session, { isReview: lessonId === null, perfect: summary.perfect, xp: lesson }), backlogClosed };
    const columns = Object.entries(DAY_COLUMNS);
    await txn.runAsync(
      `INSERT INTO day_stats (day, ${columns.map(([, c]) => c).join(', ')}) VALUES (?, ${columns.map(() => '?').join(', ')})
       ON CONFLICT(day) DO UPDATE SET ${columns.map(([, c]) => `${c} = ${c} + excluded.${c}`).join(', ')}`,
      today,
      ...columns.map(([key]) => add[key as keyof typeof DAY_COLUMNS]),
    );
    await txn.runAsync(
      'INSERT INTO activity (day, xp) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET xp = xp + excluded.xp',
      today,
      lesson,
    );

    // Награды: квест засчитывается один раз, когда впервые выполнен
    const stats = await dayStats(txn, today);
    const quests = await todayQuests(txn, today);
    for (const { quest, claimed } of quests) {
      const progress = questProgress(quest, stats);
      if (claimed || !progress.done) continue;
      await txn.runAsync('UPDATE quests SET claimed_at = ? WHERE day = ? AND quest_id = ?', at, today, quest.id);
      completed.push(progress);
      xp += QUEST_XP;
    }
    if (completed.length && quests.every(({ quest, claimed }) => claimed || completed.some((c) => c.id === quest.id))) {
      chest = (await stashCount(txn)) < STASH_MAX ? 'stash' : 'xp';
      if (chest === 'stash') await txn.runAsync("UPDATE inventory SET count = count + 1 WHERE item = 'stash'");
      else xp += CHEST_XP;
    }
    if (xp > lesson) {
      await txn.runAsync('UPDATE activity SET xp = xp + ? WHERE day = ?', xp - lesson, today);
      // Награды за квесты не входят в XP прогона — храним отдельно, чтобы пересборка прогресса их не потеряла
      await txn.runAsync(
        'INSERT INTO bonus_xp (day, xp) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET xp = xp + excluded.xp',
        today,
        xp - lesson,
      );
    }
  });

  return { xp, accuracy: summary.accuracy, perfect: summary.perfect, quests: completed, chest };
}
