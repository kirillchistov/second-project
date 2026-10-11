import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * Как проходить карточку вопроса:
 * voice — рассказать ответ, ИИ оценит по рубрике (сильнее всего для памяти и для собеседований),
 * explain — сформулировать про себя и оценить себя самому (без сети),
 * quiz — выбрать из вариантов (быстрее, удобно в дороге),
 * ask — решать каждый раз.
 */
export type CardMode = 'ask' | 'voice' | 'explain' | 'quiz';

const KEY = 'card-mode';
const listeners = new Set<() => void>();

function read(): CardMode {
  const value = Storage.getItemSync(KEY);
  return value === 'voice' || value === 'explain' || value === 'quiz' ? value : 'ask';
}

let cardMode = read();

export function setCardMode(mode: CardMode) {
  cardMode = mode;
  Storage.setItemSync(KEY, mode);
  listeners.forEach((l) => l());
}

export function useCardMode(): CardMode {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => cardMode,
  );
}
