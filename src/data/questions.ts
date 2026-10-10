import { parseQuestions } from './parse';
import type { Level, Question, TopicId } from './types';

const LEVEL_ORDER: Level[] = ['junior', 'middle', 'senior'];

// Файлы называются `<level>-<n>.md`; порядок внутри уровня — по имени файла.
const files = import.meta.glob<string>('../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function levelOf(path: string): Level {
  const name = path.split('/').at(-1) ?? '';
  const level = name.split('-')[0] as Level;
  if (!LEVEL_ORDER.includes(level)) throw new Error(`Неизвестный уровень в имени файла: ${path}`);
  return level;
}

const sortedPaths = Object.keys(files).sort((a, b) => {
  const byLevel = LEVEL_ORDER.indexOf(levelOf(a)) - LEVEL_ORDER.indexOf(levelOf(b));
  return byLevel !== 0 ? byLevel : a.localeCompare(b, 'en', { numeric: true });
});

export const QUESTIONS: Question[] = sortedPaths
  .flatMap((path) => parseQuestions(files[path], levelOf(path)))
  .map((q, i) => ({ ...q, number: i + 1 }));

export const questionBySlug = new Map(QUESTIONS.map((q) => [q.slug, q]));

export function filterQuestions(opts: {
  levels?: Level[];
  topics?: TopicId[];
  query?: string;
}): Question[] {
  const query = opts.query?.trim().toLowerCase() ?? '';
  return QUESTIONS.filter((q) => {
    if (opts.levels?.length && !opts.levels.includes(q.level)) return false;
    if (opts.topics?.length && !opts.topics.includes(q.topic)) return false;
    if (!query) return true;
    if (/^\d+$/.test(query) && q.number === Number(query)) return true;
    const haystack = `${q.title} ${q.short} ${q.body}`.toLowerCase();
    return query.split(/\s+/).every((word) => haystack.includes(word));
  });
}

/** Поиск для быстрого перехода: совпадения в заголовке выше, чем в кратком ответе, а те — выше, чем в тексте. */
export function searchQuestions(query: string, limit = 8): Question[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const rank = (q: Question) => (has(q.title) ? 3 : has(q.short) ? 2 : 1) + (String(q.number) === query.trim() ? 10 : 0);
  return filterQuestions({ query })
    .map((q) => ({ q, score: rank(q) }))
    .sort((a, b) => b.score - a.score || a.q.number - b.q.number)
    .slice(0, limit)
    .map(({ q }) => q);
}
