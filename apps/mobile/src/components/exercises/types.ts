import type { Exercise } from '@rr/content';

export type ExerciseOf<T extends Exercise['type']> = Extract<Exercise, { type: T }>;

export interface ExerciseProps<T extends Exercise['type']> {
  exercise: ExerciseOf<T>;
  /** Ответ проверен: варианты заблокированы, правильные подсвечены */
  revealed: boolean;
  onSubmit: (correct: boolean) => void;
}
