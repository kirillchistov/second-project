import { buildQuestions, type Level, type Question, type TopicId } from '@rr/content';

// Файлы называются `<level>-<n>.md`; порядок и нумерацию задаёт buildQuestions.
const files = import.meta.glob<string>('../../../../packages/content/questions/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export const QUESTIONS: Question[] = buildQuestions(files);
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
