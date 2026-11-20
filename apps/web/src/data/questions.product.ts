import { buildQuestions, type Question } from '@rr/content';
import { PRODUCT_CATALOG } from '@rr/content/product';

const files = import.meta.glob<string>('../../../../packages/content/catalogs/product/questions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const QUESTIONS: Question[] = buildQuestions(files, PRODUCT_CATALOG.levels.map((level) => level.id));
