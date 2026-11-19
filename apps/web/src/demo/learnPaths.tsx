import { createContext, useContext, type ReactNode } from 'react';
import { Outlet, useMatch } from 'react-router';
import './demo.css';

/** Куда ведут ссылки пути. В демо Pages корень — сам путь, на сайте путь живёт под /learn. */
export type LearnPaths = {
  home: string;
  lesson: (id: string) => string;
  review: string;
  /** Полный разбор в каталоге. В демо Pages каталога нет. */
  question: ((slug: string) => string) | null;
  /** На сайте лендинг не нужен: главная уже есть. */
  skipLanding: boolean;
};

export const pagesLearnPaths: LearnPaths = {
  home: '/',
  lesson: (id) => `/lesson/${id}`,
  review: '/review',
  question: null,
  skipLanding: false,
};

export const siteLearnPaths: LearnPaths = {
  home: '/learn',
  lesson: (id) => `/learn/${id}`,
  review: '/learn/review',
  question: (slug) => `/questions/${slug}`,
  skipLanding: true,
};

const LearnPathsContext = createContext<LearnPaths>(pagesLearnPaths);

export function LearnPathsProvider({ value, children }: { value: LearnPaths; children: ReactNode }) {
  return <LearnPathsContext.Provider value={value}>{children}</LearnPathsContext.Provider>;
}

export function useLearnPaths(): LearnPaths {
  return useContext(LearnPathsContext);
}

/** Список юнитов — в узкой колонке, урок — на всю ширину под шапкой сайта. */
export function LearnFrame() {
  const home = useMatch({ path: '/learn', end: true });
  if (home) {
    return (
      <div className="container container--narrow page">
        <Outlet />
      </div>
    );
  }
  return <Outlet />;
}
