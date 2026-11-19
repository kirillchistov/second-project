import { Link, createBrowserRouter, RouterProvider } from 'react-router';
import { DemoLayout } from './DemoLayout';
import { LearnPathsProvider, pagesLearnPaths, useLearnPaths } from './learnPaths';
import { LessonPage } from './LessonPage';
import { PathPage } from './PathPage';

function MissingPage() {
  const paths = useLearnPaths();
  return (
    <>
      <title>Не найдено — React Refresher, демо</title>
      <h1>Страница не найдена</h1>
      <p className="page-header__lead">Такого адреса в демо нет.</p>
      <Link to={paths.home} className="btn btn--primary">На путь</Link>
    </>
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

const router = createBrowserRouter(
  [
    {
      element: <DemoLayout />,
      children: [
        { path: '/', element: <PathPage /> },
        { path: '*', element: <MissingPage /> },
      ],
    },
    { path: '/lesson/:id', element: <LessonPage /> },
    { path: '/review', element: <LessonPage review /> },
  ],
  { basename },
);

export function DemoApp() {
  return (
    <LearnPathsProvider value={pagesLearnPaths}>
      <RouterProvider router={router} />
    </LearnPathsProvider>
  );
}
