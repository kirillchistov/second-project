import { describe, expect, test } from 'vitest';
import { cardItem } from './path.ts';
import { addDays, currentStreak, planFreezes, STASH_MAX } from './progress.ts';
import { addDayStats, EMPTY_DAY, pickQuests, QUESTS_PER_DAY, questFrom, questProgress, sessionDayStats } from './quests.ts';
import { sessionReducer, startSession } from './session.ts';
import type { Question } from '@rr/content';

const ctx = { backlog: 5, due: 10, usesVoice: true };

describe('квесты дня', () => {
  test('три разных квеста, одинаковые в течение дня и разные в разные дни', () => {
    const today = pickQuests('2026-10-13', ctx);
    expect(today).toHaveLength(QUESTS_PER_DAY);
    expect(new Set(today.map((q) => q.id)).size).toBe(QUESTS_PER_DAY);
    expect(pickQuests('2026-10-13', ctx)).toEqual(today);
    const week = Array.from({ length: 7 }, (_, i) => pickQuests(addDays('2026-10-13', i), ctx).map((q) => q.id).join());
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  test('не предлагает квесты, которые нельзя выполнить', () => {
    const fresh = { backlog: 0, due: 0, usesVoice: false };
    for (let i = 0; i < 30; i++) {
      const ids = pickQuests(addDays('2026-10-01', i), fresh).map((q) => q.id);
      expect(ids).not.toContain('backlog');
      expect(ids).not.toContain('review');
      expect(ids).not.toContain('no-hints');
    }
  });

  test('цель backlog не больше размера backlog, заголовок с числом', () => {
    const quest = questFrom('backlog', Math.min(3, 2))!;
    expect(quest.title).toBe('Закрой ошибки из Bug Backlog: 2');
    expect(questFrom('removed-quest', 1)).toBeUndefined();
  });

  test('прогресс по статистике дня', () => {
    const quest = questFrom('first-try', 10)!;
    expect(questProgress(quest, { ...EMPTY_DAY, firstTry: 4 })).toMatchObject({ value: 4, done: false });
    expect(questProgress(quest, { ...EMPTY_DAY, firstTry: 12 })).toMatchObject({ value: 10, done: true });
  });

  test('вклад сессии: ответы, первые попытки, объяснения своими словами', () => {
    const q = (slug: string) => ({ slug, title: slug }) as Question;
    let s = startSession([cardItem(q('a')), cardItem(q('b'))]);
    s = sessionReducer(s, { type: 'answer', outcome: 'good', meta: { mode: 'voice', hints: 0 } });
    s = sessionReducer(s, { type: 'continue' });
    s = sessionReducer(s, { type: 'answer', outcome: 'again', meta: { mode: 'explain', hints: 0 } });
    const stats = sessionDayStats(s, { isReview: false, perfect: false, xp: 13 });
    expect(stats).toMatchObject({ answered: 2, firstTry: 1, explained: 2, voiceNoHints: 1, perfectLessons: 0, reviews: 0, xp: 13 });
    expect(addDayStats(stats, stats).answered).toBe(4);
  });
});

describe('заморозка стрика (git stash)', () => {
  const active = ['2026-10-08', '2026-10-09', '2026-10-10'];

  test('замороженный день держит серию, но не прибавляется', () => {
    expect(currentStreak(active, '2026-10-12')).toBe(0);
    expect(currentStreak(active, '2026-10-12', ['2026-10-11'])).toBe(3);
    expect(currentStreak([...active, '2026-10-12'], '2026-10-12', ['2026-10-11'])).toBe(4);
  });

  test('закрывает пропуск, если хватает заморозок', () => {
    expect(planFreezes({ activeDays: active, frozenDays: [], today: '2026-10-12', available: 1 })).toEqual(['2026-10-11']);
    expect(planFreezes({ activeDays: active, frozenDays: [], today: '2026-10-13', available: STASH_MAX })).toEqual(['2026-10-11', '2026-10-12']);
  });

  test('не тратит заморозки впустую', () => {
    // Вчера занимались — пропуска нет
    expect(planFreezes({ activeDays: active, frozenDays: [], today: '2026-10-11', available: 2 })).toEqual([]);
    // Пропуск длиннее запаса — серию не спасти
    expect(planFreezes({ activeDays: active, frozenDays: [], today: '2026-10-14', available: 2 })).toEqual([]);
    // Защищать нечего
    expect(planFreezes({ activeDays: [], frozenDays: [], today: '2026-10-14', available: 2 })).toEqual([]);
    // Пропуск уже закрыт
    expect(planFreezes({ activeDays: active, frozenDays: ['2026-10-11'], today: '2026-10-12', available: 2 })).toEqual([]);
  });
});
