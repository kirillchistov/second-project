/**
 * Размер шрифта для блоков кода. Моноширинный символ занимает ~0.6 кегля по ширине,
 * поэтому «вписать по ширине» — это решение линейного уравнения относительно кегля.
 */
export const CODE_FONT = { min: 9, max: 22, step: 1, default: 13, fitMax: 16, charRatio: 0.6 } as const;

export type CodeFontMode = 'fit' | 'manual';

/** Самая длинная строка кода в символах (табуляция — два пробела, как в отступах банка). */
export function longestLine(code: string): number {
  return code.split('\n').reduce((max, line) => Math.max(max, line.replace(/\t/g, '  ').length), 0);
}

/**
 * Кегль, при котором самая длинная строка помещается в ширину.
 * `extraEm` — то, что растёт вместе с кеглем (колонка номеров строк), `extraPx` — фиксированные отступы.
 * Не больше fitMax (короткий код не раздувается) и не меньше min (дальше — горизонтальная прокрутка).
 */
export function fitCodeFontSize(opts: { width: number; maxChars: number; extraEm?: number; extraPx?: number }): number {
  const { width, maxChars, extraEm = 0, extraPx = 0 } = opts;
  if (width <= 0 || maxChars <= 0) return CODE_FONT.default;
  const size = (width - extraPx) / (maxChars * CODE_FONT.charRatio + extraEm);
  return Math.max(CODE_FONT.min, Math.min(CODE_FONT.fitMax, Math.floor(size * 2) / 2));
}

export function stepCodeFont(size: number, direction: 1 | -1): number {
  return Math.max(CODE_FONT.min, Math.min(CODE_FONT.max, Math.round(size) + direction * CODE_FONT.step));
}
