import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { RunResult } from '@rr/core';

/**
 * Схема базы. Миграции генерирует drizzle-kit (npm run db:generate -w @rr/api) в каталог drizzle/,
 * сервер применяет их при старте.
 */

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** В нижнем регистре: вход не зависит от регистра */
  email: text('email').notNull().unique(),
  /** Публичное имя: в лидерборде и на форуме */
  nickname: text('nickname').notNull(),
  /** Ник в нижнем регистре — уникален, чтобы не было «Kirill» и «kirill» одновременно */
  nicknameKey: text('nickname_key').notNull().unique(),
  /** scrypt$N$r$p$соль$хэш */
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Сессии: в базе только SHA-256 токена — утечка базы не даёт войти в чужой аккаунт */
export const sessions = pgTable(
  'sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

/** Прогоны уроков — неизменяемые события синхронизации; id генерирует устройство */
export const runs = pgTable(
  'runs',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    lessonId: text('lesson_id'),
    /** Локальный день пользователя YYYY-MM-DD */
    day: text('day').notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
    results: jsonb('results').$type<RunResult[]>().notNull(),
    /** XP пересчитывает сервер по правилам @rr/core, а не берёт у клиента */
    xp: integer('xp').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().default(sql`now()`),
  },
  (t) => [primaryKey({ columns: [t.userId, t.id] }), index('runs_day_idx').on(t.day)],
);

export const schema = { users, sessions, runs };
