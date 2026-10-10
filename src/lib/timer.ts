import { useEffect, useState } from 'react';

export type TimerMode = 'off' | 'soft' | 'exam';

// Идея режимов времени взята из popmath: таймер — подсказка, а не приговор.
export const TIMER_MODE_OPTIONS: { id: TimerMode; label: string; hint: string; seconds: number }[] = [
  { id: 'off', label: 'Без таймера', hint: 'Сначала качество ответа, потом скорость', seconds: 0 },
  { id: 'soft', label: 'Мягкий · 2 мин', hint: 'Подсветим, когда время выйдет, но не остановим', seconds: 120 },
  { id: 'exam', label: 'Жёсткий · 1 мин', hint: 'Время вышло — ответ открывается автоматически', seconds: 60 },
];

/** Секунды, прошедшие с момента `startedAt` (обновляется раз в секунду, пока `running`). */
export function useElapsedSeconds(startedAt: number, running = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running, startedAt]);

  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

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
