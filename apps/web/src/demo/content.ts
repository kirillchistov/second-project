import { buildPath, itemsById, type PathContent } from '@rr/core';
import { exercises } from '../data/exercises.react.ts';
import { lessonPrefix, levelOrder, TOPICS, UNITS } from '../catalog/site';
import { QUESTIONS } from '../data/questions';

export const CONTENT: PathContent = {
  units: UNITS,
  questions: QUESTIONS,
  exercises,
  levels: levelOrder,
  lessonPrefix,
};

export const PATH = buildPath(CONTENT);
export const LESSONS = PATH.flatMap((unit) => unit.lessons);
export const lessonById = new Map(LESSONS.map((lesson) => [lesson.id, lesson]));
export const ITEMS = itemsById(CONTENT);
export const topicTitle = new Map(TOPICS.map((topic) => [topic.id, topic.title]));
