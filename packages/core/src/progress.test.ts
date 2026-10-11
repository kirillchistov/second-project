import { expect, test } from 'vitest';
import { addDays, currentStreak, localDay, longestStreak } from './progress.ts';

test('локальная дата и сдвиг через границы месяца и года', () => {
  expect(localDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
});

test('стрик не сгорает, пока не закончился сегодняшний день', () => {
  const days = ['2026-10-08', '2026-10-09', '2026-10-10'];
  expect(currentStreak(days, '2026-10-10')).toBe(3);
  expect(currentStreak(days, '2026-10-11')).toBe(3);
  expect(currentStreak(days, '2026-10-12')).toBe(0);
  expect(currentStreak([], '2026-10-12')).toBe(0);
});

test('самая длинная серия', () => {
  expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-07'])).toBe(3);
  expect(longestStreak([])).toBe(0);
});
