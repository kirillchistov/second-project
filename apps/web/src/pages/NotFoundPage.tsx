import { Link } from 'react-router';
import { SITE_NAME } from '../catalog/site';

export function NotFoundPage() {
  return (
    <div className="container container--narrow page empty">
      <title>{`Не найдено — ${SITE_NAME}`}</title>
      <h1>Страница не найдена</h1>
      <p>Возможно, вопрос переехал. Попробуйте поиск или вернитесь к списку.</p>
      <Link to="/questions" className="btn btn--primary">К вопросам</Link>
    </div>
  );
}
