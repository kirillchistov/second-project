import { foldRuns, lessonXp, localDay, review, runFromSession, summarize, type LessonRun, type SessionState, type StoredCard } from '@rr/core';
import { CATALOG_ID } from '../catalog/site';
import { ITEMS } from './content';

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

const LEGACY_KEY = CATALOG_ID === 'react' ? 'rr-demo-progress' : `rr-demo-progress-${CATALOG_ID}`;
const RUNS_KEY = CATALOG_ID === 'react' ? 'rr-path-runs' : `rr-path-runs-${CATALOG_ID}`;

interface RunStore {
  runs: LessonRun[];
  /** id прогонов, которые сервер уже принял */
  synced: string[];
  /** id аккаунта, с которым эта история уже связана. null — прогресс гостя */
  owner: string | null;
}

function emptyStore(): RunStore {
  return { runs: [], synced: [], owner: null };
}

function isRun(value: unknown): value is LessonRun {
  if (!value || typeof value !== 'object') return false;
  const run = value as Partial<LessonRun>;
  return typeof run.id === 'string' && (typeof run.lessonId === 'string' || run.lessonId === null)
    && typeof run.day === 'string' && typeof run.completedAt === 'string' && Array.isArray(run.results);
}

function readStore(): RunStore {
  try {
    if (typeof localStorage === 'undefined') return emptyStore();
    const raw = localStorage.getItem(RUNS_KEY);
    if (!raw) return emptyStore();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    const record = parsed as Partial<RunStore>;
    return {
      runs: Array.isArray(record.runs) ? record.runs.filter(isRun) : [],
      synced: Array.isArray(record.synced) ? record.synced.filter((id): id is string => typeof id === 'string') : [],
      owner: typeof record.owner === 'string' ? record.owner : null,
    };
  } catch {
    return emptyStore();
  }
}

function isProgress(value: unknown): value is DemoProgress {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<DemoProgress>;
  return !!record.cards && Array.isArray(record.backlog) && !!record.activity && !!record.lessonsDone;
}

/** Прогресс, накопленный до прогонов. Он остаётся, пока не появится первый прогон. */
function readLegacy(): DemoProgress {
  try {
    if (typeof localStorage === 'undefined') return emptyProgress();
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    return isProgress(parsed) ? parsed : emptyProgress();
  } catch {
    return emptyProgress();
  }
}

function progressFromRuns(runs: readonly LessonRun[], skillOf: (itemId: string) => string | undefined): DemoProgress {
  const folded = foldRuns(runs, skillOf);
  return { cards: folded.cards, backlog: folded.backlog, activity: folded.activity, lessonsDone: folded.lessonsDone };
}

function skillOfItem(itemId: string): string | undefined {
  return ITEMS.get(itemId)?.skill;
}

let store = readStore();
let snapshot = store.runs.length ? progressFromRuns(store.runs, skillOfItem) : readLegacy();
let persistFailed = false;
const listeners = new Set<() => void>();
let lastSave: { key: string; at: number; saved: SavedLesson } | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function persistStore() {
  try {
    localStorage.setItem(RUNS_KEY, JSON.stringify(store));
    persistFailed = false;
  } catch {
    persistFailed = true;
  }
}

function commit(next: DemoProgress) {
  snapshot = next;
  persistStore();
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

export function progressOwner(): string | null {
  return store.owner;
}

export function unsyncedRuns(): LessonRun[] {
  const synced = new Set(store.synced);
  return store.runs.filter((run) => !synced.has(run.id));
}

export function markRunsSynced(ids: readonly string[]): void {
  const synced = new Set(store.synced);
  for (const id of ids) synced.add(id);
  store = { ...store, synced: [...synced] };
  persistStore();
}

/**
 * Прогоны с сервера. Уже известные id просто помечаются доставленными.
 * Возвращает, сколько прогонов оказались новыми.
 */
export function importRuns(remote: readonly LessonRun[]): number {
  const known = new Set(store.runs.map((run) => run.id));
  const synced = new Set(store.synced);
  const added: LessonRun[] = [];
  for (const run of remote) {
    synced.add(run.id);
    if (known.has(run.id)) continue;
    known.add(run.id);
    added.push(run);
  }
  store = { ...store, runs: [...store.runs, ...added], synced: [...synced] };
  if (added.length > 0) snapshot = progressFromRuns(store.runs, skillOfItem);
  persistStore();
  if (added.length > 0) emit();
  return added.length;
}

/** Чей прогресс лежит в браузере. Другой аккаунт начинает с пустой истории: чужие прогоны на сервер не уходят. */
export function adoptOwner(userId: string): void {
  if (store.owner === userId) return;
  if (store.owner) {
    store = { runs: [], synced: [], owner: userId };
    snapshot = emptyProgress();
    persistStore();
    emit();
    return;
  }
  store = { ...store, owner: userId };
  persistStore();
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

  const summary = summarize(session);
  const saved: SavedLesson = { xp: lessonXp(summary), accuracy: summary.accuracy, perfect: summary.perfect };
  if (summary.total === 0) {
    lastSave = { key, at: Date.now(), saved };
    return saved;
  }

  const run = {
    ...runFromSession(session, {
      id: crypto.randomUUID(),
      lessonId,
      day: localDay(now),
      completedAt: now.toISOString(),
    }),
    catalog: CATALOG_ID,
  };
  store = { ...store, runs: [...store.runs, run] };
  // Снимок копится поверх уже пройденного. Полная пересборка из прогонов — когда с сервера приходит чужая история.
  commit(applySession(snapshot, session, lessonId, now, skillOf).progress);
  lastSave = { key, at: Date.now(), saved };
  return saved;
}

export function resetProgress() {
  lastSave = null;
  store = { runs: [], synced: [], owner: store.owner };
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // нет хранилища — снимок в памяти всё равно пустой
  }
  commit(emptyProgress());
}
