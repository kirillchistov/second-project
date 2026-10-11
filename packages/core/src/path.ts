import type { Exercise, Level, Question, UnitDef } from '@rr/content';
import { isDue, retrievability, type StoredCard } from './srs.ts';

export type QuizExercise = Extract<Exercise, { type: 'quiz' }>;

/**
 * Элемент урока: упражнение или карточка вопроса.
 * Карточку можно пройти двумя способами: объяснить своими словами и оценить себя
 * или, если для вопроса есть `quiz`, выбрать ответ из вариантов.
 */
export type LessonItem =
  | { kind: 'exercise'; id: string; skill: string; exercise: Exercise }
  | { kind: 'card'; id: string; skill: string; question: Question; quiz?: QuizExercise };

export interface PathLesson {
  /** `<unit>-<n>`, n с 1 */
  id: string;
  unitId: string;
  index: number;
  /** Короткий «хеш коммита» — урок на пути выглядит как коммит в ветке */
  hash: string;
  questions: Question[];
  /** Практика по вопросам урока, без карточек с вариантами */
  exercises: Exercise[];
  /** Карточки с вариантами: slug вопроса → quiz */
  quizzes: ReadonlyMap<string, QuizExercise>;
}

export interface PathUnit extends UnitDef {
  lessons: PathLesson[];
}

export interface PathContent {
  units: UnitDef[];
  questions: Question[];
  exercises: Exercise[];
}

/** Сколько вопросов покрывает один урок: 3 вопроса + их упражнения ≈ 3–5 минут. */
export const QUESTIONS_PER_LESSON = 3;

const LEVEL_RANK: Record<Level, number> = { junior: 0, middle: 1, senior: 2 };

/** Навык карточки вопроса. У упражнений навык свой, из поля `skill`. */
export function cardSkill(question: Question): string {
  return `q:${question.slug}`;
}

function shortHash(input: string): string {
  // FNV-1a: стабильный и короткий, криптостойкость не нужна
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7);
}

/** Карточка с вариантами для каждого вопроса (если их несколько — первая). */
export function quizzesByQuestion(exercises: readonly Exercise[]): Map<string, QuizExercise> {
  const map = new Map<string, QuizExercise>();
  for (const ex of exercises) if (ex.type === 'quiz' && !map.has(ex.question)) map.set(ex.question, ex);
  return map;
}

/** Строит путь: юниты по порядку, внутри — уроки от простых вопросов к сложным. */
export function buildPath(content: PathContent): PathUnit[] {
  const quizzes = quizzesByQuestion(content.exercises);
  const exercisesByQuestion = new Map<string, Exercise[]>();
  for (const ex of content.exercises) {
    if (!ex.question || ex.type === 'quiz') continue;
    exercisesByQuestion.set(ex.question, [...(exercisesByQuestion.get(ex.question) ?? []), ex]);
  }

  return content.units.map((unit) => {
    const questions = content.questions
      .filter((q) => unit.topics.includes(q.topic))
      .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || a.number - b.number);

    const lessons: PathLesson[] = [];
    for (let i = 0; i < questions.length; i += QUESTIONS_PER_LESSON) {
      const chunk = questions.slice(i, i + QUESTIONS_PER_LESSON);
      const index = lessons.length + 1;
      const id = `${unit.id}-${index}`;
      lessons.push({
        id,
        unitId: unit.id,
        index,
        hash: shortHash(id),
        questions: chunk,
        exercises: chunk.flatMap((q) => exercisesByQuestion.get(q.slug) ?? []),
        quizzes: new Map(chunk.filter((q) => quizzes.has(q.slug)).map((q) => [q.slug, quizzes.get(q.slug)!])),
      });
    }
    return { ...unit, lessons };
  });
}

export function exerciseItem(exercise: Exercise): LessonItem {
  return { kind: 'exercise', id: `ex:${exercise.id}`, skill: exercise.skill, exercise };
}

export function cardItem(question: Question, quiz?: QuizExercise): LessonItem {
  return { kind: 'card', id: `q:${question.slug}`, skill: cardSkill(question), question, quiz };
}

/**
 * Элементы урока: по каждому вопросу сначала практика, затем карточка.
 * Порядок «сначала попробуй, потом сверь» — retrieval practice, а не перечитывание.
 */
export function lessonItems(lesson: PathLesson): LessonItem[] {
  return lesson.questions.flatMap((q) => [
    ...lesson.exercises.filter((ex) => ex.question === q.slug).map(exerciseItem),
    cardItem(q, lesson.quizzes.get(q.slug)),
  ]);
}

/** Все элементы, которые могут встретиться в уроках, по id — чтобы восстановить их из БД. */
export function itemsById(content: PathContent): Map<string, LessonItem> {
  const quizzes = quizzesByQuestion(content.exercises);
  const items = [
    ...content.exercises.filter((ex) => ex.type !== 'quiz').map(exerciseItem),
    ...content.questions.map((q) => cardItem(q, quizzes.get(q.slug))),
  ];
  return new Map(items.map((item) => [item.id, item]));
}

/**
 * Урок повторения: сначала ошибки из Bug Backlog, затем навыки, которые пора повторить,
 * начиная с самых «забытых». На каждый навык — одно упражнение (если есть) вместо карточки.
 */
export function reviewItems(opts: {
  content: PathContent;
  cards: ReadonlyMap<string, StoredCard>;
  backlog: readonly string[];
  now: Date;
  limit?: number;
}): LessonItem[] {
  const { content, cards, backlog, now, limit = 10 } = opts;
  const byId = itemsById(content);
  const picked: LessonItem[] = [];
  const usedSkills = new Set<string>();

  const add = (item: LessonItem | undefined) => {
    if (!item || picked.length >= limit || usedSkills.has(item.skill)) return;
    usedSkills.add(item.skill);
    picked.push(item);
  };

  for (const id of backlog) add(byId.get(id));

  const due = [...cards.entries()]
    .filter(([, card]) => isDue(card, now))
    .sort(([, a], [, b]) => retrievability(a, now) - retrievability(b, now));

  const items = [...byId.values()];
  for (const [skill] of due) {
    add(items.find((i) => i.skill === skill && i.kind === 'exercise') ?? items.find((i) => i.skill === skill));
  }
  return picked;
}

/** Сколько навыков пора повторить прямо сейчас. */
export function dueCount(cards: ReadonlyMap<string, StoredCard>, now: Date): number {
  let n = 0;
  for (const card of cards.values()) if (isDue(card, now)) n++;
  return n;
}
