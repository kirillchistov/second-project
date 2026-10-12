import { expect, test } from 'vitest';
import { CODE_FONT, fitCodeFontSize, longestLine, stepCodeFont } from './codeFont.ts';

test('самая длинная строка', () => {
  expect(longestLine('ab\n    abcdef\nabc')).toBe(10);
  expect(longestLine('\tx')).toBe(3);
});

test('вписанный кегль: строка помещается в ширину', () => {
  const size = fitCodeFontSize({ width: 360, maxChars: 50, extraEm: 2, extraPx: 26 });
  expect(size * (50 * CODE_FONT.charRatio + 2) + 26).toBeLessThanOrEqual(360);
  expect(size).toBeGreaterThanOrEqual(CODE_FONT.min);
});

test('короткий код не раздувается, очень длинный — не мельче минимума', () => {
  expect(fitCodeFontSize({ width: 360, maxChars: 10 })).toBe(CODE_FONT.fitMax);
  expect(fitCodeFontSize({ width: 360, maxChars: 200 })).toBe(CODE_FONT.min);
  expect(fitCodeFontSize({ width: 0, maxChars: 10 })).toBe(CODE_FONT.default);
});

test('шаг кегля в пределах', () => {
  expect(stepCodeFont(13, 1)).toBe(14);
  expect(stepCodeFont(9.5, -1)).toBe(CODE_FONT.min);
  expect(stepCodeFont(CODE_FONT.max, 1)).toBe(CODE_FONT.max);
});
