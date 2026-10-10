export function formatDuration(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? '−' : '';
  const s = Math.abs(totalSeconds);
  const m = Math.floor(s / 60);
  return `${sign}${m}:${String(s % 60).padStart(2, '0')}`;
}

export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
