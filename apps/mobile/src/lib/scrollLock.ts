import { createContext, use } from 'react';

/**
 * Перетаскивание внутри прокручиваемого экрана: пока палец тащит элемент, прокрутка выключается,
 * иначе ScrollView перехватит жест. Экран урока передаёт сюда свой переключатель.
 */
export const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

export function useScrollLock(): (locked: boolean) => void {
  return use(ScrollLockContext);
}
