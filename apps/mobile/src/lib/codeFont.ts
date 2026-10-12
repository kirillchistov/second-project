import { CODE_FONT, fitCodeFontSize, stepCodeFont, type CodeFontMode } from '@rr/core';
import Storage from 'expo-sqlite/kv-store';
import { useCallback, useState, useSyncExternalStore } from 'react';
import type { LayoutChangeEvent } from 'react-native';

/**
 * Размер шрифта в блоках кода — общий для всего приложения и сохраняется между запусками.
 * fit — вписать самую длинную строку в ширину экрана (по умолчанию), manual — выбранный кнопками кегль.
 */
export interface CodeFontSetting {
  mode: CodeFontMode;
  size: number;
}

const KEY = 'code-font';
const listeners = new Set<() => void>();

function read(): CodeFontSetting {
  try {
    const saved = JSON.parse(Storage.getItemSync(KEY) ?? 'null') as CodeFontSetting | null;
    if (saved && (saved.mode === 'fit' || saved.mode === 'manual') && typeof saved.size === 'number') return saved;
  } catch {
    // повреждённое значение — вернёмся к умолчанию
  }
  return { mode: 'fit', size: CODE_FONT.default };
}

let setting = read();

function save(next: CodeFontSetting) {
  setting = next;
  Storage.setItemSync(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

export function useCodeFont(): CodeFontSetting {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => setting,
  );
}

/** «−»/«+» переходят в ручной режим, начиная от того кегля, что сейчас на экране. */
export function stepCodeFontFrom(current: number, direction: 1 | -1) {
  save({ mode: 'manual', size: stepCodeFont(current, direction) });
}

export function fitCodeFont() {
  save({ ...setting, mode: 'fit' });
}

/**
 * Кегль для конкретного блока: в режиме fit зависит от ширины блока, поэтому её меряем через onLayout.
 * extraEm — колонка номеров строк (растёт с кеглем), extraPx — отступы и рамка.
 */
export function useCodeFontSize(maxChars: number, extra: { em?: number; px?: number } = {}) {
  const font = useCodeFont();
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);
  const size =
    font.mode === 'manual' ? font.size : fitCodeFontSize({ width, maxChars, extraEm: extra.em, extraPx: extra.px });
  return { size, mode: font.mode, onLayout };
}
