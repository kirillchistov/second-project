import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
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
      { path: '/questions', element: <CatalogPage /> },
      { path: '/questions/:slug', element: <QuestionPage /> },
      { path: '/practice', element: <PracticePage /> },
      { path: '/interview', element: <InterviewPage /> },
      { path: '/account', element: <AccountPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
