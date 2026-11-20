import { buildQuestions, type Question } from '@rr/content';

// Путь совпадает с группами чанков в vite.config.ts: правка текста не сбрасывает кеш остального сайта.
const files = import.meta.glob<string>('../../../../packages/content/questions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const QUESTIONS: Question[] = buildQuestions(files);
