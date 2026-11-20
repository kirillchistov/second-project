import { parseExercises, type Exercise } from '@rr/content/exercises';

const files = import.meta.glob<string>('../../../../packages/content/exercises/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const exercises: Exercise[] = Object.entries(files)
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([file, raw]) => parseExercises(raw, file));
