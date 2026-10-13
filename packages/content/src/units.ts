import type { TopicId } from './types.ts';

export interface UnitDef {
  id: string;
  title: string;
  /** Чему учит юнит — одной фразой, для карточки на пути */
  goal: string;
  topics: TopicId[];
}

/**
 * Порядок юнитов на пути обучения: от ядра React к архитектуре.
 * Вопросы и упражнения попадают в юнит по теме вопроса.
 */
export const UNITS: UnitDef[] = [
  { id: 'core', title: 'Ядро React', goal: 'Компоненты, рендеринг, reconciliation и ключи', topics: ['basics', 'rendering'] },
  { id: 'hooks', title: 'Хуки в деталях', goal: 'Эффекты без гонок, рефы, правила хуков, свои хуки', topics: ['hooks'] },
  { id: 'state', title: 'Состояние и данные', goal: 'Когда Context, когда Zustand или Redux, когда TanStack Query', topics: ['state'] },
  { id: 'modern', title: 'React 19+', goal: 'Actions, use, useOptimistic, Compiler, Activity', topics: ['modern'] },
  { id: 'server', title: 'SSR и RSC', goal: 'Стратегии рендеринга, гидрация, стриминг, Server Components', topics: ['server'] },
  { id: 'performance', title: 'Производительность', goal: 'Сначала измерить, потом оптимизировать', topics: ['performance'] },
  { id: 'typescript', title: 'TypeScript для React', goal: 'Типизация props, хуков и обобщённых компонентов', topics: ['typescript'] },
  { id: 'testing', title: 'Тестирование', goal: 'Testing Library, MSW, стратегия тестов', topics: ['testing'] },
  { id: 'quality', title: 'Доступность и безопасность', goal: 'a11y, XSS, CSP, обработка ошибок', topics: ['quality'] },
  { id: 'ecosystem', title: 'Экосистема', goal: 'Роутинг, сборка, фреймворки, стили', topics: ['ecosystem'] },
  { id: 'fullstack', title: 'Fullstack', goal: 'HTTP и кэширование, дизайн API, аутентификация, Node.js, базы и очереди', topics: ['fullstack'] },
  { id: 'architecture', title: 'Архитектура', goal: 'Структура проекта, паттерны, дизайн-системы, микрофронтенды', topics: ['architecture'] },
];
