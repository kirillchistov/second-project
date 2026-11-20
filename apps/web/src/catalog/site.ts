import { REACT_CATALOG, type Catalog } from '@rr/content';
import { PRODUCT_CATALOG } from '@rr/content/product';

const CATALOG: Catalog = import.meta.env.MODE === 'product' ? PRODUCT_CATALOG : REACT_CATALOG;

export const CATALOG_ID = CATALOG.id;
export const SITE_NAME = CATALOG.id === 'product' ? 'Практикум продукта' : 'React Refresher';
export const SITE_DESCRIPTION = CATALOG.id === 'product'
  ? 'Короткий путь продакта: теория, квиз и рабочие шаблоны. Без голосовой проверки и без оценки свободного текста.'
  : '224 актуальных вопроса для собеседования на React-разработчика: Junior, Middle, Senior. React 19, Server Components, React Compiler.';
/** Собеседование по грейдам есть только у каталога React. */
export const INTERVIEW = CATALOG.id === 'react';
export const LEVELS = CATALOG.levels;
export const TOPICS = CATALOG.topics;
export const UNITS = CATALOG.units;
export const levelOrder = CATALOG.levels.map((level) => level.id);
export const lessonPrefix = CATALOG.lessonPrefix;
export const levelTitle: Record<string, string> = Object.fromEntries(CATALOG.levels.map((level) => [level.id, level.title]));
export const topicById: Record<string, { title: string }> = Object.fromEntries(
  CATALOG.topics.map((topic) => [topic.id, topic]),
);
