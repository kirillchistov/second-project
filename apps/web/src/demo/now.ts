import { useSyncExternalStore } from 'react';

/**
 * Часы демо. `new Date()` не вызывается в рендере: иначе стрик и «пора повторить»
 * залипали бы на времени первого кадра. Обновление — раз в минуту и при возврате на вкладку.
 */
let now = new Date();
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;

function tick() {
  now = new Date();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop && typeof window !== 'undefined') {
    const interval = window.setInterval(tick, 60_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    stop = () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      stop = null;
    };
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop?.();
  };
}

export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => now, () => now);
}
