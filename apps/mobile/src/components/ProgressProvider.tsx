import { getDatabase, loadProgress, saveSession, type ProgressSnapshot } from '@/lib/db';
import { ProgressContext } from '@/lib/progress';
import type { SessionState } from '@rr/core';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

const EMPTY: ProgressSnapshot = { cards: new Map(), backlog: [], activity: new Map(), lessonsDone: new Map() };

/** Прогресс пользователя в памяти; после каждого сохранения перечитывается из SQLite. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    getDatabase()
      .then(loadProgress)
      .then((loaded) => active && setSnapshot(loaded))
      .catch((error) => console.error('Не удалось загрузить прогресс', error));
    return () => {
      active = false;
    };
  }, []);

  const save = useCallback(async (session: SessionState, lessonId: string | null) => {
    const db = await getDatabase();
    const saved = await saveSession(db, session, lessonId, new Date());
    setSnapshot(await loadProgress(db));
    return saved;
  }, []);

  const value = useMemo(() => ({ ...(snapshot ?? EMPTY), ready: snapshot !== null, save }), [snapshot, save]);
  return <ProgressContext value={value}>{children}</ProgressContext>;
}
