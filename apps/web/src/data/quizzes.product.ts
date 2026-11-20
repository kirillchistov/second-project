import type { QuizExercise } from '@rr/content';
import { exercises } from './exercises.react.ts';

const map = new Map<string, QuizExercise>();
for (const exercise of exercises) {
  if (exercise.type === 'quiz' && exercise.question && !map.has(exercise.question)) map.set(exercise.question, exercise);
}

export const quizByQuestion = map;
