import { TOPICS, UNITS, buildQuestions } from '@rr/content';
import { parseExercises } from '@rr/content/exercises';
import { buildPath, itemsById, type PathContent } from '@rr/core';

const questionFiles = import.meta.glob<string>('../../../../packages/content/questions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const exerciseFiles = import.meta.glob<string>('../../../../packages/content/exercises/*.yaml', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const CONTENT: PathContent = {
  units: UNITS,
  questions: buildQuestions(questionFiles),
  exercises: Object.entries(exerciseFiles)
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([file, raw]) => parseExercises(raw, file)),
};

export const PATH = buildPath(CONTENT);
export const LESSONS = PATH.flatMap((unit) => unit.lessons);
export const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
export const ITEMS = itemsById(CONTENT);
export const topicTitle = new Map(TOPICS.map((topic) => [topic.id, topic.title]));
