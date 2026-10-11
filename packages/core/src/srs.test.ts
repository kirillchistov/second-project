import { describe, expect, test } from 'vitest';
import { isDue, isLearned, retrievability, review } from './srs.ts';

const day = 24 * 60 * 60 * 1000;
const t0 = new Date('2026-10-01T09:00:00');

describe('интервальное повторение', () => {
  test('карточка переживает JSON без потерь', () => {
    const card = review(undefined, 'good', t0);
    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    expect(typeof card.due).toBe('string');
  });

  test('ошибка возвращает навык быстрее, чем верный ответ', () => {
    const good = review(undefined, 'good', t0);
    const again = review(undefined, 'again', t0);
    expect(new Date(again.due).getTime()).toBeLessThan(new Date(good.due).getTime());
  });

  test('интервалы растут при успешных повторениях', () => {
    let card = review(undefined, 'good', t0);
    let now = t0;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      now = new Date(card.due);
      card = review(card, 'good', now);
      intervals.push(new Date(card.due).getTime() - now.getTime());
    }
    expect(isLearned(card)).toBe(true);
    expect(intervals.at(-1)!).toBeGreaterThan(intervals[1]);
    expect(intervals.at(-1)!).toBeGreaterThan(day);
  });

  test('навык становится «к повторению», когда наступает срок', () => {
    const card = review(undefined, 'good', t0);
    expect(isDue(card, t0)).toBe(false);
    expect(isDue(card, new Date(new Date(card.due).getTime() + 1))).toBe(true);
  });

  test('вероятность вспомнить падает со временем', () => {
    let card = review(undefined, 'good', t0);
    card = review(card, 'good', new Date(card.due));
    const soon = retrievability(card, new Date(card.due));
    const later = retrievability(card, new Date(new Date(card.due).getTime() + 30 * day));
    expect(later).toBeLessThan(soon);
  });
});
