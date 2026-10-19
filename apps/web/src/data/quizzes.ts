import quizzes from '@rr/content/quizzes.json';
import type { QuizExercise } from '@rr/content';

/** Карточка с вариантами ответа на вопрос, если для него есть quiz (см. packages/content/exercises). */
export const quizByQuestion = new Map(Object.entries(quizzes as Record<string, QuizExercise>));
