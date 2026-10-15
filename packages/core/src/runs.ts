import { lessonXp } from './progress.ts';
import type { AnswerMode, SessionState, SessionSummary } from './session.ts';
import { review, type Outcome, type StoredCard } from './srs.ts';

/**
 * Прогон урока или повторения — неизменяемое событие с id, которое генерирует устройство.
 * Это единица синхронизации: устройство досылает прогоны на сервер, повторная отправка того же id
 * ничего не меняет, а прогресс (карточки, backlog, XP по дням) восстанавливается сборкой истории прогонов.
 * Так у синхронизации нет конфликтов: два устройства просто добавляют события в общую историю.
 */
export interface RunResult {
  itemId: string;
  /** Результат первой попытки — именно он двигает карточку навыка */
  first: Outcome;
  attempts: number;
  mode?: AnswerMode;
  hints?: number;
}

export interface LessonRun {
  id: string;
  /** null — сессия повторения */
  lessonId: string | null;
  /** Локальный день пользователя `YYYY-MM-DD`: стрик и XP считаются по его часам */
  day: string;
  /** ISO-время завершения — порядок применения прогонов */
  completedAt: string;
  results: RunResult[];
}

export function runFromSession(
  session: SessionState,
  opts: { id: string; lessonId: string | null; day: string; completedAt: string },
): LessonRun {
  return {
    ...opts,
    results: Object.entries(session.results).map(([itemId, r]) => ({
      itemId,
      first: r.first,
      attempts: r.attempts,
      ...(r.meta ? { mode: r.meta.mode, hints: r.meta.hints } : {}),
    })),
  };
}

export function runSummary(run: LessonRun): SessionSummary {
  const firstTry = run.results.filter((r) => r.first !== 'again').length;
  const total = run.results.length;
  return {
    total,
    firstTry,
    accuracy: total ? firstTry / total : 0,
    perfect: total > 0 && firstTry === total,
    mistakes: run.results.filter((r) => r.first === 'again').map((r) => r.itemId),
  };
}

/** XP за прогон — по тем же правилам, что и на устройстве. Награды за квесты сюда не входят: они локальные. */
export function runXp(run: LessonRun): number {
  return lessonXp(runSummary(run));
}

export interface FoldedProgress {
  /** навык → карточка FSRS */
  cards: Record<string, StoredCard>;
  /** id элементов с ошибкой, в порядке появления */
  backlog: string[];
  /** id элемента в backlog → когда он туда попал (completedAt прогона) */
  backlogSince: Record<string, string>;
  /** день → XP за прогоны */
  activity: Record<string, number>;
  /** id урока → лучшая точность */
  lessonsDone: Record<string, number>;
}

/** Порядок применения: по времени завершения, при равенстве — по id, чтобы результат не зависел от порядка прихода. */
export function compareRuns(a: LessonRun, b: LessonRun): number {
  return a.completedAt.localeCompare(b.completedAt) || a.id.localeCompare(b.id);
}

/**
 * Прогресс из истории прогонов: каждый прогон применяется так же, как при сохранении урока на устройстве.
 * `skillOf` — навык элемента по его id; элементы, которых больше нет в контенте, пропускаются.
 */
export function foldRuns(runs: readonly LessonRun[], skillOf: (itemId: string) => string | undefined): FoldedProgress {
  const cards: Record<string, StoredCard> = {};
  const backlog = new Map<string, string>();
  const activity: Record<string, number> = {};
  const lessonsDone: Record<string, number> = {};

  for (const run of [...runs].sort(compareRuns)) {
    const at = new Date(run.completedAt);
    for (const r of run.results) {
      const skill = skillOf(r.itemId);
      if (!skill) continue;
      cards[skill] = review(cards[skill], r.first, at);
      if (r.first === 'again') {
        if (!backlog.has(r.itemId)) backlog.set(r.itemId, run.completedAt);
      } else {
        backlog.delete(r.itemId);
      }
    }
    activity[run.day] = (activity[run.day] ?? 0) + runXp(run);
    if (run.lessonId) lessonsDone[run.lessonId] = Math.max(lessonsDone[run.lessonId] ?? 0, runSummary(run).accuracy);
  }

  return { cards, backlog: [...backlog.keys()], backlogSince: Object.fromEntries(backlog), activity, lessonsDone };
}
