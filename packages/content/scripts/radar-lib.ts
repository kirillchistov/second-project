/**
 * Чистые части радара: источники, промпты, формат сопоставления и отчёт. Сетевая часть — в radar.ts.
 */
import { z } from 'zod';
import type { Exercise } from '../src/exercises.ts';
import type { Question } from '../src/types.ts';

export interface Library {
  name: string;
  /** Откуда начинать веб-поиск (режим --web): блог, changelog, релизы на GitHub */
  sources: string[];
  /** owner/repo на GitHub: стабильные релизы забираются через API бесплатно */
  repo?: string;
  /** RSS/Atom официального блога */
  feed?: string;
  /** Какие релизы репозитория брать (в монорепо много пакетов для других фреймворков) */
  include?: RegExp;
}

export const LIBRARIES: Library[] = [
  { name: 'React и React DOM', sources: ['https://react.dev/blog', 'https://github.com/facebook/react/releases'], repo: 'facebook/react', feed: 'https://react.dev/rss.xml' },
  { name: 'Next.js (App Router)', sources: ['https://nextjs.org/blog'], repo: 'vercel/next.js', feed: 'https://nextjs.org/feed.xml' },
  {
    name: 'TanStack Query',
    sources: ['https://github.com/TanStack/query/releases'],
    repo: 'TanStack/query',
    include: /@tanstack\/(react-query|query-core)@/,
  },
  { name: 'React Router', sources: ['https://reactrouter.com/changelog'], repo: 'remix-run/react-router' },
  { name: 'TypeScript', sources: ['https://devblogs.microsoft.com/typescript/'], repo: 'microsoft/TypeScript', feed: 'https://devblogs.microsoft.com/typescript/feed/' },
  { name: 'Vite', sources: ['https://vite.dev/blog'], repo: 'vitejs/vite' },
];

// ─── Сбор релизов без модели ─────────────────────────────────────────────────

export interface Release {
  library: string;
  version: string;
  date: string;
  url: string;
  notes: string;
}

/** Ограничение на одну запись: changelog крупных релизов бывает на десятки тысяч символов. */
export const MAX_NOTES_CHARS = 6000;

export function trimNotes(text: string, max = MAX_NOTES_CHARS): string {
  const clean = text.replace(/<!--[\s\S]*?-->/g, '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return clean.length > max ? `${clean.slice(0, max)}\n…(обрезано)` : clean;
}

export interface GithubRelease {
  tag_name: string;
  name: string | null;
  body: string | null;
  html_url: string;
  published_at: string | null;
  draft: boolean;
  prerelease: boolean;
}

/** Стабильные релизы с даты since: черновики и пререлизы (canary, beta, rc) пропускаем. */
export function stableReleasesSince(library: string, releases: readonly GithubRelease[], since: string, include?: RegExp): Release[] {
  return releases
    .filter((r) => !r.draft && !r.prerelease && r.published_at && r.published_at.slice(0, 10) >= since)
    .filter((r) => !/canary|alpha|beta|rc|nightly|experimental/i.test(r.tag_name))
    .filter((r) => !include || include.test(`${r.tag_name} ${r.name ?? ''}`))
    .map((r) => ({
      library,
      version: r.name || r.tag_name,
      date: r.published_at!.slice(0, 10),
      url: r.html_url,
      notes: trimNotes(r.body ?? ''),
    }));
}

/** Записи RSS/Atom с даты since: заголовок, ссылка и описание. Простой разбор без XML-библиотеки. */
export function feedItemsSince(library: string, xml: string, since: string): Release[] {
  const items = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/g) ?? [];
  const pick = (block: string, tag: string) =>
    block
      .match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`))?.[1]
      ?.replace(/<!\[CDATA\[|\]\]>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() ?? '';
  return items.flatMap((block) => {
    const raw = pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'updated');
    const time = Date.parse(raw);
    if (Number.isNaN(time)) return [];
    const date = new Date(time).toISOString().slice(0, 10);
    if (date < since) return [];
    const link = block.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? pick(block, 'link');
    return [{ library, version: pick(block, 'title'), date, url: link, notes: trimNotes(pick(block, 'description') || pick(block, 'summary') || pick(block, 'content'), 2000) }];
  });
}

/**
 * Текст статьи из HTML: без скриптов, стилей и навигации; если есть <article> или <main> — только они.
 * Простое преобразование без DOM: для сводки модели точность разметки не нужна.
 */
export function htmlToText(html: string): string {
  const body = html.match(/<article[\s>][\s\S]*?<\/article>/i)?.[0] ?? html.match(/<main[\s>][\s\S]*?<\/main>/i)?.[0] ?? html;
  return body
    .replace(/<(script|style|nav|header|footer|svg|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(br|\/p|\/h\d|\/li|\/pre)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Сводка собранного для модели: компактный текст, по библиотекам. */
export function releasesDigest(releases: readonly Release[]): string {
  if (releases.length === 0) return 'За период не найдено ни одного стабильного релиза и записи в блогах.';
  return releases.map((r) => `### ${r.library} — ${r.version} (${r.date})\n${r.url}\n\n${r.notes || '(без описания)'}`).join('\n\n');
}

export const RESEARCH_SYSTEM = `Ты — технический редактор тренажёра по React для middle-разработчиков.
Твоя задача — найти, что изменилось в библиотеках за период, и описать только то, что меняет,
как разработчик пишет код или отвечает на собеседовании: новые API, изменения поведения, deprecation и удаления,
новые рекомендации официальной документации. Патчи с исправлением багов без изменения API пропускай.

Используй web_search и web_fetch, опирайся на первоисточники (официальные блоги, changelog, release notes).
Для каждого изменения укажи библиотеку, версию, дату, суть в 1–3 предложениях и ссылку на источник.
Если за период по библиотеке ничего значимого не вышло — так и напиши. Не выдумывай версии и API:
если не нашёл подтверждения в источнике, не включай изменение.`;

export function researchPrompt(libraries: readonly Library[], since: string, until: string): string {
  const list = libraries.map((l) => `- ${l.name}: ${l.sources.join(', ')}`).join('\n');
  return `Период: с ${since} по ${until}.

Библиотеки и источники для старта:
${list}

Напиши сводку по каждой библиотеке: версия, дата, значимые изменения со ссылками.`;
}

export const MAPPING_SYSTEM = `Ты — редактор банка вопросов и упражнений тренажёра по React (целевая версия материала — React 19.2).
Тебе дают сводку изменений в библиотеках (release notes и записи блогов либо результаты исследования) и индекс банка.
Учитывай только то, что меняет, как разработчик пишет код или отвечает на собеседовании: новые API, изменения
поведения, deprecation, новые рекомендации. Исправления багов без изменения API пропускай. Не выдумывай: опирайся
только на текст сводки. Определи:

1. changes — значимые изменения (библиотека, версия, суть в 1–3 предложениях, ссылка из сводки).
2. affected — вопросы, материал которых устарел или требует дополнения из-за изменений. Для каждого:
   slug, change — что именно изменилось и как это должно отразиться в упражнениях (2–4 предложения),
   questionEdit — конкретная правка текста вопроса (что заменить или дописать), или пустая строка,
   outdatedExercises — id упражнений, ответ или формулировка которых стали неверными. Не включай упражнения,
   которые просто можно дополнить, — только реально устаревшие.
3. newQuestions — темы, которых в банке нет, но которые теперь стоит спрашивать у middle (заголовок вопроса, тема, почему).

Будь консервативен: вопрос затронут, только если изменение действительно меняет правильный ответ
или добавляет то, что спросят на собеседовании. Если ничего не затронуто — пустые списки.`;

export function mappingPrompt(findings: string, questions: readonly Question[], exercises: readonly Exercise[]): string {
  const index = questions
    .map((q) => {
      const own = exercises.filter((e) => e.question === q.slug).map((e) => `    - ${e.id}: ${e.prompt}`);
      const verified = q.verified?.length ? ` · проверено: ${q.verified.join(', ')}` : '';
      return `- ${q.slug} [${q.topic}, ${q.level}${verified}] ${q.title}\n  Кратко: ${q.short}\n${own.join('\n')}`;
    })
    .join('\n');
  return `## Сводка изменений\n\n${findings}\n\n## Индекс банка\n\n${index}`;
}

export const mappingOutput = z.object({
  changes: z.array(z.object({ library: z.string(), version: z.string(), summary: z.string(), source: z.string() })),
  affected: z.array(
    z.object({
      slug: z.string(),
      change: z.string(),
      questionEdit: z.string(),
      outdatedExercises: z.array(z.string()),
    }),
  ),
  newQuestions: z.array(z.object({ title: z.string(), topic: z.string(), why: z.string() })),
});
export type Mapping = z.infer<typeof mappingOutput>;

/** Отчёт для человека: что вышло, что поправить в вопросах, что удалить из банка и какие темы добавить. */
export function renderRadarReport(
  result: Mapping & { since: string; until: string },
  findings: string,
  questions: readonly Question[],
): string {
  const title = new Map(questions.map((q) => [q.slug, q.title]));
  const lines: string[] = [`# Радар изменений: ${result.since} — ${result.until}`, ''];

  lines.push('## Значимые изменения', '');
  if (result.changes.length === 0) lines.push('Значимых изменений за период нет.');
  for (const c of result.changes) lines.push(`- **${c.library} ${c.version}** — ${c.summary} ([источник](${c.source}))`);

  lines.push('', '## Затронутые вопросы', '');
  if (result.affected.length === 0) lines.push('Банк актуален — правки не нужны.');
  for (const a of result.affected) {
    lines.push(`### ${title.get(a.slug) ?? a.slug} (\`${a.slug}\`)`, '', a.change, '');
    if (a.questionEdit) lines.push(`**Правка вопроса:** ${a.questionEdit}`, '');
    if (a.outdatedExercises.length) lines.push(`**Устаревшие упражнения:** ${a.outdatedExercises.map((id) => `\`${id}\``).join(', ')}`, '');
  }

  const retire = result.affected.flatMap((a) => a.outdatedExercises);
  lines.push('## Что сделать', '');
  lines.push('1. Внести правки в вопросы и обновить у них `@verified` и `@updated`.');
  lines.push('2. Вычитать черновики в `exercises/drafts` и принять: `npm run approve -w @rr/content -- --all`.');
  if (retire.length) lines.push(`3. Убрать устаревшие упражнения: \`npm run approve -w @rr/content -- --retire ${retire.join(',')}\`.`);

  if (result.newQuestions.length) {
    lines.push('', '## Новые темы для банка', '');
    for (const n of result.newQuestions) lines.push(`- **${n.title}** (${n.topic}) — ${n.why}`);
  }

  lines.push('', '<details><summary>Полная сводка исследования</summary>', '', findings, '', '</details>', '');
  return lines.join('\n');
}
