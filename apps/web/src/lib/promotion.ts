import type { Question } from '@rr/content';

/**
 * Постепенный переход от «узнавания» к «вспоминанию»: Junior-вопрос, на который несколько раз подряд
 * ответили верно в режиме вариантов, дальше в сессиях с вариантами показывается уже как «Свой ответ».
 * Эксперимент — пока только для Junior, счётчик живёт в localStorage этого браузера.
 */
const STORAGE_KEY = 'rr-quiz-streak';
const THRESHOLD = 2;

function readAll(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(streaks: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(streaks));
  } catch {
    // localStorage недоступен (приватный режим) — счётчик просто не запомнится
  }
}

/** Вопрос пора показывать как «Свой ответ», даже если выбран режим вариантов */
export function isPromoted(question: Question): boolean {
  if (question.level !== 'junior') return false;
  return (readAll()[question.slug] ?? 0) >= THRESHOLD;
}

/** Верный ответ в вариантах — счётчик растёт, неверный — сбрасывается */
export function recordQuizAnswer(question: Question, correct: boolean): void {
  if (question.level !== 'junior') return;
  const streaks = readAll();
  streaks[question.slug] = correct ? (streaks[question.slug] ?? 0) + 1 : 0;
  writeAll(streaks);
}
