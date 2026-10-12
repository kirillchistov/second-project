import { lessonXp, localDay, review, summarize, type SessionState, type StoredCard } from '@rr/core';

/** Прогресс демо: всё, что в мобильном приложении лежит в SQLite, здесь живёт в localStorage. */
export interface DemoProgress {
  cards: Record<string, StoredCard>;
  backlog: string[];
  /** день `YYYY-MM-DD` → XP */
  activity: Record<string, number>;
  /** id урока → лучшая точность */
  lessonsDone: Record<string, number>;
}

export interface SavedLesson {
  xp: number;
  accuracy: number;
  perfect: boolean;
}

export function emptyProgress(): DemoProgress {
  return { cards: {}, backlog: [], activity: {}, lessonsDone: {} };
}

/**
 * Завершённый урок поверх снимка прогресса.
 * Первая попытка двигает карточку навыка, ошибка попадает в backlog, успех убирает её оттуда.
 */
export function applySession(
  progress: DemoProgress,
  session: SessionState,
  lessonId: string | null,
  now: Date,
  skillOf: (itemId: string) => string | undefined,
): { progress: DemoProgress; saved: SavedLesson } {
  const summary = summarize(session);
  const xp = lessonXp(summary);
  const day = localDay(now);
  const cards = { ...progress.cards };
  let backlog = [...progress.backlog];

  for (const [itemId, result] of Object.entries(session.results)) {
    const skill = skillOf(itemId);
    if (!skill) continue;
    cards[skill] = review(cards[skill], result.first, now);
    backlog = result.first === 'again'
      ? backlog.includes(itemId) ? backlog : [...backlog, itemId]
      : backlog.filter((id) => id !== itemId);
  }

  const lessonsDone = { ...progress.lessonsDone };
  if (lessonId) lessonsDone[lessonId] = Math.max(lessonsDone[lessonId] ?? 0, summary.accuracy);

  return {
    saved: { xp, accuracy: summary.accuracy, perfect: summary.perfect },
    progress: {
      cards,
      backlog,
      activity: { ...progress.activity, [day]: (progress.activity[day] ?? 0) + xp },
      lessonsDone,
    },
  };
}

const STORAGE_KEY = 'rr-demo-progress';

function isProgress(value: unknown): value is DemoProgress {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DemoProgress>;
  return !!record.cards && Array.isArray(record.backlog) && !!record.activity && !!record.lessonsDone;
}

export function readProgress(): DemoProgress {
  try {
    if (typeof localStorage === 'undefined') return emptyProgress();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

let snapshot = readProgress();
let persistFailed = false;
const listeners = new Set<() => void>();
let lastSave: { key: string; at: number; saved: SavedLesson } | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: DemoProgress) {
  snapshot = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    persistFailed = false;
  } catch {
    persistFailed = true;
  }
  emit();
}

export function getProgress(): DemoProgress {
  return snapshot;
}

export function progressPersistFailed(): boolean {
  return persistFailed;
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Повторный вызов с тем же итогом за пару секунд не пишет XP второй раз (Strict Mode). */
export function saveLesson(
  session: SessionState,
  lessonId: string | null,
  now: Date,
  skillOf: (itemId: string) => string | undefined,
): SavedLesson {
  const key = JSON.stringify({
    lessonId,
    results: Object.fromEntries(Object.entries(session.results).map(([id, result]) => [id, result.first])),
  });
  if (lastSave && lastSave.key === key && Date.now() - lastSave.at < 2000) return lastSave.saved;
  const applied = applySession(snapshot, session, lessonId, now, skillOf);
  commit(applied.progress);
  lastSave = { key, at: Date.now(), saved: applied.saved };
  return applied.saved;
}

export function resetProgress() {
  lastSave = null;
  commit(emptyProgress());
}
