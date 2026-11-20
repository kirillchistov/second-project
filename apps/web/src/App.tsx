import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { INTERVIEW } from './catalog/site';
import { Layout } from './components/Layout';
import { LearnFrame, LearnPathsProvider, siteLearnPaths } from './demo/learnPaths';
import { LessonPage } from './demo/LessonPage';
import { PathPage } from './demo/PathPage';
import { AboutPage } from './pages/AboutPage';
import { AccountPage } from './pages/AccountPage';
import { CatalogPage } from './pages/CatalogPage';
import { HomePage } from './pages/HomePage';
import { InterviewPage } from './pages/InterviewPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PracticePage } from './pages/PracticePage';
import { QuestionPage } from './pages/QuestionPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomePage /> },
      {
        path: '/learn',
        element: (
          <LearnPathsProvider value={siteLearnPaths}>
            <LearnFrame />
          </LearnPathsProvider>
        ),
        children: [
          { index: true, element: <PathPage /> },
          { path: 'review', element: <LessonPage review /> },
          { path: ':id', element: <LessonPage /> },
        ],
      },
      { path: '/questions', element: <CatalogPage /> },
      { path: '/questions/:slug', element: <QuestionPage /> },
      { path: '/practice', element: <PracticePage /> },
      { path: '/interview', element: INTERVIEW ? <InterviewPage /> : <Navigate to="/" replace /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
