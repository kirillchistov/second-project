import type { SessionSummary } from './session.ts';

/** Дневная цель по умолчанию: примерно один урок и одно повторение. */
export const DAILY_GOAL_XP = 30;

export const XP = {
  firstTry: 10,
  afterMistake: 3,
  lessonComplete: 5,
  perfectBonus: 10,
} as const;

/** XP за урок: за каждое задание, за завершение и бонус за урок без ошибок. */
export function lessonXp(summary: SessionSummary): number {
  if (summary.total === 0) return 0;
  const items = summary.firstTry * XP.firstTry + (summary.total - summary.firstTry) * XP.afterMistake;
  return items + XP.lessonComplete + (summary.perfect ? XP.perfectBonus : 0);
}

/** Локальная дата `YYYY-MM-DD`: день стрика считается по часам пользователя, а не по UTC. */
export function localDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + delta));
}

/**
 * Текущий стрик — сколько дней подряд была активность.
 * Если сегодня ещё не занимались, стрик не сгорает до конца дня: считаем от вчера.
 */
export function currentStreak(activeDays: Iterable<string>, today: string): number {
  const days = new Set(activeDays);
  let day = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

/** Самая длинная серия за всё время. */
export function longestStreak(activeDays: Iterable<string>): number {
  const sorted = [...new Set(activeDays)].sort();
  let best = 0;
  let run = 0;
  sorted.forEach((day, i) => {
    run = i > 0 && addDays(sorted[i - 1], 1) === day ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}
