import type { Exercise } from './exercises.ts';
import type { Rubric } from './rubrics.ts';
import type { LegacyQuestion } from './legacy.ts';
import type { Level, Question, Topic } from './types.ts';
import type { UnitDef } from './units.ts';

/** Формат `dist/content.json` — то, что получает мобильное приложение. */
export interface ContentBundle {
  schemaVersion: number;
  /** Хеш содержимого: меняется только при изменении контента */
  version: string;
  generatedAt: string;
  levels: { id: Level; title: string; description: string }[];
  topics: Topic[];
  units: UnitDef[];
  questions: Question[];
  exercises: Exercise[];
  legacy: LegacyQuestion[];
}

/**
 * Формат `dist/server.json` — контент, который нужен API: вопросы и рубрики для проверки ответов.
 * API встраивает его в сборку (на Vercel функция не видит файлы packages/content).
 */
export interface ServerBundle {
  version: string;
  questions: Question[];
  rubrics: Rubric[];
}
