import type { QuizExercise } from '@rr/content';
import quizzes from '@rr/content/quizzes.json';

/** Карточка с вариантами ответа на вопрос, если для него есть quiz. */
export const quizByQuestion = new Map(Object.entries(quizzes as Record<string, QuizExercise>));
