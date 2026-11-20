import { LEVELS, TOPICS } from './topics.ts';
import { UNITS, type UnitDef } from './units.ts';

export interface CatalogLevel {
  id: string;
  title: string;
  description: string;
}

export interface CatalogTopic {
  id: string;
  title: string;
  description: string;
}

/**
 * Каталог выбирается при сборке сайта. Движок уроков один,
 * а уровни, темы и префикс идентификаторов у каждого каталога свои.
 */
export interface Catalog {
  id: string;
  /** Пусто у React: уроки остаются `core-1`. Иначе `product-discovery-1`. */
  lessonPrefix: string;
  levels: CatalogLevel[];
  topics: CatalogTopic[];
  units: UnitDef[];
}

export const REACT_CATALOG: Catalog = {
  id: 'react',
  lessonPrefix: '',
  levels: LEVELS,
  topics: TOPICS,
  units: UNITS,
};
