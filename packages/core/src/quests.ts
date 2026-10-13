import type { SessionState } from './session.ts';

/**
 * Квесты дня: три небольшие цели, которые меняются каждый день и тянут к полезному поведению —
 * закрыть ошибки, повторить забытое, объяснить своими словами. Выполнил все три — «сундук» с заморозкой стрика.
 */

/** Что произошло за день: копится при сохранении каждого урока и повторения. */
export interface DayStats {
  /** Ответов (заданий и карточек), считая каждое один раз */
  answered: number;
  /** Из них верно с первой попытки */
  firstTry: number;
  /** Ошибок, закрытых из Bug Backlog */
  backlogClosed: number;
  /** Уроков пути без единой ошибки */
  perfectLessons: number;
  /** Пройденных сессий повторения */
  reviews: number;
  /** Карточек, на которые ответили своими словами (голосом или про себя), а не выбором варианта */
  explained: number;
  /** Верных ответов голосом без подсказок */
  voiceNoHints: number;
  xp: number;
}

export const EMPTY_DAY: DayStats = {
  answered: 0,
  firstTry: 0,
  backlogClosed: 0,
  perfectLessons: 0,
  reviews: 0,
  explained: 0,
  voiceNoHints: 0,
  xp: 0,
};

/** Вклад одной сессии в статистику дня (кроме закрытых багов — их знает только база). */
export function sessionDayStats(session: SessionState, opts: { isReview: boolean; perfect: boolean; xp: number }): DayStats {
  const results = Object.values(session.results);
  return {
    answered: results.length,
    firstTry: results.filter((r) => r.first !== 'again').length,
    backlogClosed: 0,
    perfectLessons: !opts.isReview && opts.perfect && results.length > 0 ? 1 : 0,
    reviews: opts.isReview && results.length > 0 ? 1 : 0,
    explained: results.filter((r) => r.meta?.mode === 'voice' || r.meta?.mode === 'explain').length,
    voiceNoHints: results.filter((r) => r.meta?.mode === 'voice' && r.meta.hints === 0 && r.first !== 'again').length,
    xp: opts.xp,
  };
}

export function addDayStats(a: DayStats, b: DayStats): DayStats {
  const sum = { ...a };
  for (const key of Object.keys(sum) as (keyof DayStats)[]) sum[key] += b[key];
  return sum;
}

/** Что известно о пользователе на начало дня: от этого зависит, какие квесты имеют смысл. */
export interface QuestContext {
  backlog: number;
  /** Навыков, которые пора повторить */
  due: number;
  /** Отвечал ли когда-нибудь голосом: квест «без подсказок» не предлагаем тем, кто голосом не пользуется */
  usesVoice: boolean;
}

interface QuestDef {
  id: string;
  /** {n} заменяется на цель */
  title: string;
  icon: string;
  metric: keyof DayStats;
  target: (ctx: QuestContext) => number;
  available?: (ctx: QuestContext) => boolean;
}

export const QUESTS: readonly QuestDef[] = [
  { id: 'xp', title: 'Набери {n} XP', icon: 'flash', metric: 'xp', target: () => 50 },
  { id: 'first-try', title: 'Ответь верно с первой попытки {n} раз', icon: 'checkmark-done', metric: 'firstTry', target: () => 10 },
  { id: 'perfect', title: 'Пройди урок без ошибок', icon: 'ribbon', metric: 'perfectLessons', target: () => 1 },
  {
    id: 'backlog',
    title: 'Закрой ошибки из Bug Backlog: {n}',
    icon: 'bug',
    metric: 'backlogClosed',
    target: (ctx) => Math.min(3, ctx.backlog),
    available: (ctx) => ctx.backlog >= 1,
  },
  { id: 'review', title: 'Пройди повторение', icon: 'refresh', metric: 'reviews', target: () => 1, available: (ctx) => ctx.due + ctx.backlog >= 3 },
  { id: 'explain', title: 'Объясни своими словами {n} вопроса', icon: 'chatbubbles', metric: 'explained', target: () => 2 },
  {
    id: 'no-hints',
    title: 'Ответь голосом без подсказок',
    icon: 'mic',
    metric: 'voiceNoHints',
    target: () => 1,
    available: (ctx) => ctx.usesVoice,
  },
];

export const QUESTS_PER_DAY = 3;
export const QUEST_XP = 10;
/** Награда сундука, если запас заморозок уже полон */
export const CHEST_XP = 20;

export interface Quest {
  id: string;
  title: string;
  icon: string;
  metric: keyof DayStats;
  target: number;
}

export interface QuestProgress extends Quest {
  value: number;
  done: boolean;
}

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Квесты на день: детерминированно по дате из подходящих. Выбор сохраняется в базе в начале дня,
 * чтобы не менялся, когда за день поменяется backlog.
 */
export function pickQuests(day: string, ctx: QuestContext): Quest[] {
  return QUESTS.filter((q) => q.available?.(ctx) ?? true)
    .map((q) => ({ q, order: hash(`${day}:${q.id}`) }))
    .sort((a, b) => a.order - b.order)
    .slice(0, QUESTS_PER_DAY)
    .map(({ q }) => questFrom(q.id, q.target(ctx))!);
}

/** Квест по id и сохранённой цели; неизвестный id (квест убрали из приложения) — undefined. */
export function questFrom(id: string, target: number): Quest | undefined {
  const def = QUESTS.find((q) => q.id === id);
  if (!def) return undefined;
  return { id, title: def.title.replace('{n}', String(target)), icon: def.icon, metric: def.metric, target };
}

export function questProgress(quest: Quest, stats: DayStats): QuestProgress {
  const value = Math.min(stats[quest.metric], quest.target);
  return { ...quest, value, done: value >= quest.target };
}
