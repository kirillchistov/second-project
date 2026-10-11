import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';

/**
 * Карточка FSRS в виде, пригодном для JSON и SQLite: даты — ISO-строки.
 * Одна карточка — один атом навыка, а не одно упражнение: разные упражнения на один навык
 * двигают одну и ту же кривую забывания.
 */
export type StoredCard = Omit<Card, 'due' | 'last_review'> & { due: string; last_review?: string };

/** Как прошла попытка: из неё получается оценка FSRS. */
export type Outcome = 'again' | 'hard' | 'good' | 'easy';

const GRADE: Record<Outcome, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

// Без fuzz расписание детерминировано — проще тестировать и объяснять пользователю.
const scheduler = fsrs(generatorParameters({ enable_fuzz: false, request_retention: 0.9 }));

function toStored(card: Card): StoredCard {
  return {
    ...card,
    due: card.due.toISOString(),
    last_review: card.last_review?.toISOString(),
  };
}

export function newCard(now: Date): StoredCard {
  return toStored(createEmptyCard(now));
}

/** Применяет результат попытки к карточке навыка; для нового навыка карточка создаётся. */
export function review(card: StoredCard | undefined, outcome: Outcome, now: Date): StoredCard {
  const { card: next } = scheduler.next(card ?? newCard(now), now, GRADE[outcome]);
  return toStored(next);
}

export function isDue(card: StoredCard, now: Date): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

/** Вероятность вспомнить навык прямо сейчас, 0..1. Для нового навыка — 0. */
export function retrievability(card: StoredCard, now: Date): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}

/** Навык считается выученным, когда он вышел из фазы заучивания. */
export function isLearned(card: StoredCard): boolean {
  return card.state === State.Review;
}
