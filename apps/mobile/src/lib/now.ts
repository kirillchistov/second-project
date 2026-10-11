import { AppState } from 'react-native';
import { useSyncExternalStore } from 'react';

/**
 * Общие «часы» приложения. Время не берётся в рендере напрямую: тогда экран, открытый через полночь
 * или после часа в фоне, показывал бы вчерашний стрик и устаревшие повторения.
 * Обновляются раз в минуту и при возвращении приложения на экран.
 */
let now = new Date();
const listeners = new Set<() => void>();

function tick() {
  now = new Date();
  listeners.forEach((l) => l());
}

let stop: (() => void) | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    // Один таймер на всё приложение, пока есть хоть один подписчик
    const interval = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && tick());
    stop = () => {
      clearInterval(interval);
      sub.remove();
      stop = null;
    };
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stop?.();
  };
}

export function useNow(): Date {
  return useSyncExternalStore(subscribe, () => now);
}
