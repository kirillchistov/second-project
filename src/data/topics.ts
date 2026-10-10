import type { Level, Topic, TopicId } from './types';

export const LEVELS: { id: Level; title: string; description: string }[] = [
  {
    id: 'junior',
    title: 'Junior',
    description: 'Фундамент: JSX, props, state, списки, события и базовые хуки.',
  },
  {
    id: 'middle',
    title: 'Middle',
    description: 'Хуки в деталях, данные, формы, TypeScript, тесты и типичные ошибки.',
  },
  {
    id: 'senior',
    title: 'Senior',
    description: 'Внутреннее устройство, конкурентный рендеринг, React 19, RSC, архитектура.',
  },
];

export const TOPICS: Topic[] = [
  { id: 'basics', title: 'Основы', description: 'JSX, компоненты, props, state, события' },
  { id: 'rendering', title: 'Рендеринг', description: 'Reconciliation, Fiber, фазы рендера' },
  { id: 'hooks', title: 'Хуки', description: 'useState, useEffect, useRef и собственные хуки' },
  { id: 'state', title: 'Состояние и данные', description: 'Context, Redux Toolkit, Zustand, TanStack Query' },
  { id: 'modern', title: 'React 19+', description: 'Actions, use, useOptimistic, Compiler, Activity' },
  { id: 'server', title: 'SSR и RSC', description: 'Гидрация, стриминг, Server Components' },
  { id: 'performance', title: 'Производительность', description: 'Мемоизация, профилирование, Web Vitals' },
  { id: 'typescript', title: 'TypeScript', description: 'Типизация компонентов, хуков и обобщений' },
  { id: 'testing', title: 'Тестирование', description: 'Testing Library, Vitest, MSW, Playwright' },
  { id: 'architecture', title: 'Архитектура', description: 'Паттерны, структура, дизайн-системы' },
  { id: 'quality', title: 'Доступность и безопасность', description: 'a11y, XSS, CSP, обработка ошибок' },
  { id: 'ecosystem', title: 'Экосистема', description: 'Vite, роутинг, фреймворки, стили' },
];

export const topicById = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<TopicId, Topic>;

export const levelTitle: Record<Level, string> = {
  junior: 'Junior',
  middle: 'Middle',
  senior: 'Senior',
};
