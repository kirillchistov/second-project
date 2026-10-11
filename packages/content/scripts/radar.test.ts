import { expect, test } from 'vitest';
import { loadExercises, loadQuestions } from '../src/node.ts';
import { removeExercises } from './bank.ts';
import { feedItemsSince, htmlToText, LIBRARIES, mappingPrompt, releasesDigest, renderRadarReport, researchPrompt, stableReleasesSince, trimNotes } from './radar-lib.ts';

const questions = loadQuestions();
const exercises = loadExercises();

test('промпт исследования содержит период и источники', () => {
  const prompt = researchPrompt(LIBRARIES, '2026-07-01', '2026-10-11');
  expect(prompt).toContain('с 2026-07-01 по 2026-10-11');
  expect(prompt).toContain('https://react.dev/blog');
});

test('индекс банка перечисляет вопросы и их упражнения', () => {
  const prompt = mappingPrompt('сводка', questions, exercises);
  expect(prompt).toContain('- keys [rendering');
  expect(prompt).toContain('keys-quiz:');
});

test('отчёт: изменения, правки вопросов и команда удаления устаревших', () => {
  const report = renderRadarReport(
    {
      since: '2026-07-01',
      until: '2026-10-11',
      changes: [{ library: 'React', version: '19.3', summary: 'новый хук', source: 'https://react.dev/blog/x' }],
      affected: [{ slug: 'keys', change: 'поменялось', questionEdit: 'дописать абзац', outdatedExercises: ['keys-quiz'] }],
      newQuestions: [{ title: 'Что такое X?', topic: 'modern', why: 'спрашивают' }],
    },
    'полная сводка',
    questions,
  );
  expect(report).toContain('**React 19.3** — новый хук');
  expect(report).toContain('Зачем нужен key');
  expect(report).toContain('--retire keys-quiz');
  expect(report).toContain('Что такое X?');
});

test('удаление упражнений сохраняет соседей и их комментарии', () => {
  const text = [
    '- id: a',
    '  skill: s',
    '',
    '# вычитка: про b',
    '- id: b',
    '  skill: s',
    '  code: |-',
    '    line',
    '',
    '# keys: принято из черновика',
    '- id: c',
    '  skill: s',
    '',
  ].join('\n');
  const { text: out, removed } = removeExercises(text, new Set(['b', 'missing']));
  expect(removed).toEqual(['b']);
  expect(out).not.toContain('id: b');
  expect(out).not.toContain('про b');
  expect(out).toContain('- id: a');
  expect(out).toContain('# keys: принято из черновика\n- id: c');
});

test('из релизов GitHub берутся только стабильные с даты since', () => {
  const r = (tag: string, date: string, extra: object = {}) => ({
    tag_name: tag, name: tag, body: `notes ${tag}`, html_url: `https://gh/${tag}`, published_at: `${date}T10:00:00Z`, draft: false, prerelease: false, ...extra,
  });
  const releases = [
    r('v19.3.0', '2026-09-09'),
    r('v19.3.0-canary.1', '2026-09-01'),
    r('v19.2.9', '2026-08-01', { prerelease: true }),
    r('v19.2.1', '2026-05-01'),
  ];
  expect(stableReleasesSince('React', releases, '2026-07-01').map((x) => x.version)).toEqual(['v19.3.0']);
});

test('RSS и Atom: записи с даты since с заголовком, ссылкой и описанием', () => {
  const rss = `<rss><channel>
    <item><title>React 19.3</title><link>https://react.dev/blog/a</link><pubDate>Tue, 09 Sep 2026 00:00:00 GMT</pubDate><description><![CDATA[<p>New <b>hooks</b></p>]]></description></item>
    <item><title>Old</title><link>https://react.dev/blog/b</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
  </channel></rss>`;
  expect(feedItemsSince('React', rss, '2026-07-01')).toEqual([
    { library: 'React', version: 'React 19.3', date: '2026-09-09', url: 'https://react.dev/blog/a', notes: 'New hooks' },
  ]);
  const atom = `<feed><entry><title>TS 7.0</title><link href="https://devblogs/ts7"/><published>2026-08-20T00:00:00Z</published><summary>Go port</summary></entry></feed>`;
  expect(feedItemsSince('TypeScript', atom, '2026-07-01')[0]).toMatchObject({ url: 'https://devblogs/ts7', notes: 'Go port' });
});

test('длинные заметки обрезаются, пустой период описан явно', () => {
  expect(trimNotes('x'.repeat(10), 5)).toBe('xxxxx\n…(обрезано)');
  expect(releasesDigest([])).toMatch(/не найдено/);
});

test('фильтр пакетов монорепо: у TanStack берём только React и ядро', () => {
  const base = { body: '', html_url: 'u', published_at: '2026-09-01T00:00:00Z', draft: false, prerelease: false };
  const releases = ['@tanstack/react-query@5.90.0', '@tanstack/vue-query@5.90.0', '@tanstack/query-core@5.90.0'].map((t) => ({ ...base, tag_name: t, name: t }));
  const tanstack = LIBRARIES.find((l) => l.name === 'TanStack Query')!;
  expect(stableReleasesSince('TanStack Query', releases, '2026-07-01', tanstack.include).map((r) => r.version)).toEqual([
    '@tanstack/react-query@5.90.0',
    '@tanstack/query-core@5.90.0',
  ]);
});

test('текст статьи: только article, без скриптов и навигации, с расшифровкой сущностей', () => {
  const html = '<html><nav>Меню</nav><article><h1>React 19.3</h1><script>x()</script><p>Новый &lt;ViewTransition&gt; &amp; Fragment refs</p></article><footer>©</footer></html>';
  expect(htmlToText(html)).toBe('React 19.3\nНовый <ViewTransition> & Fragment refs');
});
