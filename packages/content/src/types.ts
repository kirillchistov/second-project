export type Level = 'junior' | 'middle' | 'senior';

export type TopicId =
  | 'basics'
  | 'rendering'
  | 'hooks'
  | 'state'
  | 'modern'
  | 'server'
  | 'performance'
  | 'typescript'
  | 'testing'
  | 'architecture'
  | 'quality'
  | 'ecosystem'
  | 'fullstack';

export interface Topic {
  id: TopicId;
  title: string;
  description: string;
}

export interface QuestionLink {
  label: string;
  href: string;
}

export interface Question {
  /** Порядковый номер с 1 — по уровню, затем по порядку в файлах */
  number: number;
  slug: string;
  level: Level;
  topic: TopicId;
  title: string;
  /** Краткий ответ — то, что стоит сказать в первые 30 секунд */
  short: string;
  /** Развёрнутое объяснение в Markdown */
  body: string;
  pitfalls: string[];
  followUps: string[];
  links: QuestionLink[];
  /** Номер вопроса из старой версии (PDF, 50 вопросов), если вопрос вырос из него */
  legacy?: number;
  /** Версии, для которых материал проверен: `@verified react@19.2, next@16` */
  verified?: string[];
  /** Когда материал последний раз сверялся с актуальными версиями: `@updated 2026-10` */
  updated?: string;
}
