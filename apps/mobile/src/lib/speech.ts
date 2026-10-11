import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Диктовка через распознавание речи iOS (expo-speech-recognition). Это нативный модуль:
 * в Expo Go его нет — тогда голос недоступен и остаётся текстовый ввод.
 */
type SpeechModule = typeof import('expo-speech-recognition');

const speech: SpeechModule | null = (() => {
  try {
    const mod = require('expo-speech-recognition') as SpeechModule;
    return mod.ExpoSpeechRecognitionModule.isRecognitionAvailable() ? mod : null;
  } catch {
    return null;
  }
})();

export const speechAvailable = speech !== null;

/** Частые термины: распознаватель лучше узнаёт английские слова внутри русской речи. */
const COMMON_TERMS = [
  'React', 'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'useContext', 'useReducer',
  'Suspense', 'props', 'state', 'key', 'JSX', 'Fiber', 'reconciliation', 'render', 'commit', 'cleanup',
  'TypeScript', 'Redux', 'Zustand', 'TanStack Query', 'Server Components', 'SSR', 'hydration',
];

export function termsFrom(text: string): string[] {
  const found = [...text.matchAll(/`([^`]{2,30})`/g)].map((m) => m[1].replace(/[()<>{}]/g, '').trim());
  return [...new Set([...found, ...COMMON_TERMS])].slice(0, 60);
}

export type DictationState = 'unavailable' | 'idle' | 'listening';

/**
 * Диктовка, которая дописывает распознанное к уже набранному тексту:
 * можно наговорить, поправить руками и договорить ещё.
 */
export function useDictation(text: string, setText: (text: string) => void, terms: string[]) {
  const [state, setState] = useState<DictationState>(speechAvailable ? 'idle' : 'unavailable');
  const [error, setError] = useState<string | null>(null);
  // Текст до начала текущей записи: распознанное в сессии приходит целиком и дописывается к нему
  const baseRef = useRef('');

  useEffect(() => {
    if (!speech) return;
    const m = speech.ExpoSpeechRecognitionModule;
    const subs = [
      m.addListener('result', (e) => {
        const heard = e.results[0]?.transcript ?? '';
        setText([baseRef.current, heard].filter(Boolean).join(' '));
      }),
      m.addListener('end', () => setState('idle')),
      m.addListener('error', (e) => {
        setState('idle');
        // Пауза без речи и ручная остановка — не ошибки для пользователя
        if (e.error !== 'no-speech' && e.error !== 'aborted') setError('Не получилось распознать речь. Попробуй ещё раз или напиши текстом.');
      }),
    ];
    return () => {
      subs.forEach((s) => s.remove());
      m.abort();
    };
  }, [setText]);

  const start = useCallback(async () => {
    if (!speech) return;
    setError(null);
    const permission = await speech.ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Нет доступа к микрофону или распознаванию речи — разреши его в настройках iOS.');
      return;
    }
    baseRef.current = text.trim();
    speech.ExpoSpeechRecognitionModule.start({
      lang: 'ru-RU',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
      contextualStrings: terms,
    });
    setState('listening');
  }, [text, terms]);

  const stop = useCallback(() => speech?.ExpoSpeechRecognitionModule.stop(), []);

  return { state, error, start, stop };
}
