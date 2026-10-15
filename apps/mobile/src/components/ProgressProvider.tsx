import { syncProgress } from '@/lib/account';
import { getDatabase, loadProgress, saveSession, startDay, type ProgressSnapshot } from '@/lib/db';
import { useNow } from '@/lib/now';
import { syncReminders, useReminderSettings } from '@/lib/reminders';
import { ProgressContext } from '@/lib/progress';
import { loadSession, useAccount } from '@/lib/session';
import { localDay, type SessionState } from '@rr/core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

const EMPTY: ProgressSnapshot = {
  cards: new Map(),
  backlog: [],
  activity: new Map(),
  lessonsDone: new Map(),
  voice: { answers: 0, withoutHints: 0 },
  frozenDays: new Set(),
  stash: 0,
  quests: [],
};

/**
 * Прогресс пользователя в памяти; после каждого сохранения перечитывается из SQLite.
 * При смене дня (приложение пережило полночь или вернулось из фона на следующий день) день начинается заново:
 * заморозки закрывают пропуск, выбираются новые квесты.
 */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const today = localDay(useNow());

  useEffect(() => {
    let active = true;
    getDatabase()
      .then(async (db) => {
        const now = new Date();
        await startDay(db, now);
        return loadProgress(db, now);
      })
      .then((loaded) => active && setSnapshot(loaded))
      .catch((error) => console.error('Не удалось загрузить прогресс', error));
    return () => {
      active = false;
    };
  }, [today]);

  /** Синхронизация с сервером; если пришли прогоны с другого устройства — перечитываем прогресс */
  const sync = useCallback(
    () =>
      syncProgress()
        .then(async (imported) => (imported > 0 ? loadProgress(await getDatabase(), new Date()) : null))
        .then((reloaded) => reloaded && setSnapshot(reloaded)),
    [],
  );

  const save = useCallback(
    async (session: SessionState, lessonId: string | null) => {
      const db = await getDatabase();
      const now = new Date();
      const saved = await saveSession(db, session, lessonId, now);
      setSnapshot(await loadProgress(db, now));
      // Без await: итог урока не ждёт сети
      void sync();
      return saved;
    },
    [sync],
  );

  // Аккаунт: сессия из Keychain при старте, синхронизация после входа и в начале каждого дня
  const account = useAccount();
  const signedInAs = account.status === 'signed-in' ? account.user.id : null;
  useEffect(() => {
    void loadSession();
  }, []);
  useEffect(() => {
    if (!signedInAs) return;
    // После входа прогресс перечитываем всегда: при смене аккаунта локальный прогресс очищается
    let active = true;
    syncProgress()
      .then(async () => loadProgress(await getDatabase(), new Date()))
      .then((reloaded) => active && setSnapshot(reloaded))
      .catch((error) => console.warn('Не удалось синхронизировать', error));
    return () => {
      active = false;
    };
  }, [signedInAs, today]);

  // Расписание напоминаний следует за прогрессом и настройками: выполнил цель — сегодняшнее снимается
  const reminders = useReminderSettings();
  useEffect(() => {
    if (!snapshot) return;
    syncReminders(snapshot, new Date()).catch((error) => console.warn('Не удалось обновить напоминания', error));
  }, [snapshot, reminders]);

  const value = useMemo(() => ({ ...(snapshot ?? EMPTY), ready: snapshot !== null, save, sync }), [snapshot, save, sync]);
  return <ProgressContext value={value}>{children}</ProgressContext>;
}
