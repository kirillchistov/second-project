import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { QUESTIONS } from '../data/questions';
import { Inline, Markdown } from './Markdown';

test('инлайн-разметка: код, жирный, курсив, ссылки', () => {
  const html = renderToStaticMarkup(<Inline text="**жирный** и *курсив*, `a * b` и [ссылка](https://react.dev)" />);
  expect(html).toBe(
    '<strong>жирный</strong> и <em>курсив</em>, <code>a * b</code> и <a href="https://react.dev" target="_blank" rel="noreferrer">ссылка</a>',
  );
});

test.each(QUESTIONS.map((q) => [q.number, q.slug, q] as const))('#%i %s рендерится без «сырой» разметки', (_n, _slug, q) => {
  const html = renderToStaticMarkup(<Markdown source={q.body} />);
  // Всё, что не код, не должно содержать незакрытых маркеров Markdown
  const textOutsideCode = html.replace(/<pre[\s\S]*?<\/pre>/g, '').replace(/<code>[\s\S]*?<\/code>/g, '');
  expect(textOutsideCode).not.toMatch(/```|\*\*|\]\(http/);
  expect(textOutsideCode).not.toMatch(/^\s*#{1,3} /m);
});
