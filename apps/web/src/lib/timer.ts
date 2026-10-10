import { useEffect, useState } from 'react';

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
