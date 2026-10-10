import type { Level, Question, QuestionLink, TopicId } from './types';

export type ParsedQuestion = Omit<Question, 'number'>;

const SECTION_PITFALLS = 'Подводные камни';
const SECTION_FOLLOW_UPS = 'Что спросят дальше';
const SECTION_LINKS = 'Ссылки';

/** Делит текст на блоки по заголовкам `# `, не заходя внутрь ```-блоков кода. */
function splitByH1(raw: string): string[][] {
  const chunks: string[][] = [];
  let inFence = false;
  for (const line of raw.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('# ')) chunks.push([]);
    chunks.at(-1)?.push(line);
  }
  return chunks;
}

function listItems(lines: string[]): string[] {
  return lines
    .filter((l) => /^\s*-\s+/.test(l))
    .map((l) => l.replace(/^\s*-\s+/, '').trim());
}

function parseLinks(lines: string[]): QuestionLink[] {
  return listItems(lines).map((item) => {
    const m = item.match(/^\[(.+?)\]\((.+?)\)$/);
    if (!m) throw new Error(`Некорректная ссылка: ${item}`);
    return { label: m[1], href: m[2] };
  });
}

export function parseQuestions(raw: string, level: Level): ParsedQuestion[] {
  return splitByH1(raw).map((lines) => {
    const title = lines[0].slice(2).trim();
    const meta: Record<string, string> = {};
    const short: string[] = [];
    const sections: Record<string, string[]> = { body: [] };
    let current = 'body';
    let inFence = false;
    let shortDone = false;

    for (const line of lines.slice(1)) {
      if (line.startsWith('```')) inFence = !inFence;
      if (!inFence) {
        const metaMatch = line.match(/^@(\w+)\s+(.+)$/);
        if (metaMatch) {
          meta[metaMatch[1]] = metaMatch[2].trim();
          continue;
        }
        if (!shortDone && line.startsWith('>')) {
          short.push(line.replace(/^>\s?/, ''));
          continue;
        }
        if (short.length > 0 && line.trim() !== '') shortDone = true;
        const h3 = line.match(/^###\s+(.+)$/);
        if (h3 && [SECTION_PITFALLS, SECTION_FOLLOW_UPS, SECTION_LINKS].includes(h3[1].trim())) {
          current = h3[1].trim();
          sections[current] = [];
          continue;
        }
      }
      sections[current].push(line);
    }

    if (!meta.slug || !meta.topic) {
      throw new Error(`У вопроса «${title}» нет @slug или @topic`);
    }

    return {
      slug: meta.slug,
      level,
      topic: meta.topic as TopicId,
      title,
      short: short.join(' ').trim(),
      body: sections.body.join('\n').trim(),
      pitfalls: listItems(sections[SECTION_PITFALLS] ?? []),
      followUps: listItems(sections[SECTION_FOLLOW_UPS] ?? []),
      links: parseLinks(sections[SECTION_LINKS] ?? []),
      legacy: meta.legacy ? Number(meta.legacy) : undefined,
    };
  });
}
