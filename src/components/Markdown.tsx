import { Fragment, type ReactNode } from 'react';
import { CodeBlock } from './CodeBlock';

/**
 * Небольшой рендерер подмножества Markdown, которого хватает для ответов:
 * абзацы, ### заголовки, списки, таблицы, блоки кода, `код`, **жирный**, *курсив* и [ссылки](url).
 */
type Block =
  | { kind: 'code'; lang: string; code: string }
  | { kind: 'heading'; level: 2 | 3; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'paragraph'; text: string };

const isListItem = (line: string) => /^\s*(-|\d+\.)\s+/.test(line);
const splitRow = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

function parseBlocks(source: string): Block[] {
  const lines = source.split('\n');
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++;
      blocks.push({ kind: 'code', lang, code: code.join('\n') });
      continue;
    }

    const heading = line.match(/^(#{2,3})\s+(.+)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length as 2 | 3, text: heading[2] });
      i++;
      continue;
    }

    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(splitRow(lines[i++]));
      const [head, , ...body] = rows;
      blocks.push({ kind: 'table', head, rows: body });
      continue;
    }

    if (isListItem(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (isListItem(lines[i]) || (lines[i].startsWith('  ') && lines[i].trim()))) {
        if (isListItem(lines[i])) items.push(lines[i].replace(/^\s*(-|\d+\.)\s+/, ''));
        else items[items.length - 1] += ' ' + lines[i].trim();
        i++;
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const text: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('```') &&
      !/^#{2,3}\s/.test(lines[i]) &&
      !isListItem(lines[i]) &&
      !lines[i].trim().startsWith('|')
    ) {
      text.push(lines[i++]);
    }
    blocks.push({ kind: 'paragraph', text: text.join(' ') });
  }

  return blocks;
}

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;

export function Inline({ text }: { text: string }): ReactNode {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length > 1) {
      return <code key={i}>{part.slice(1, -1)}</code>;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}><Inline text={part.slice(2, -2)} /></strong>;
    }
    if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      return <em key={i}><Inline text={part.slice(1, -1)} /></em>;
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer">
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className="prose">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case 'code':
            return <CodeBlock key={i} code={block.code} language={block.lang} />;
          case 'heading':
            return block.level === 2 ? (
              <h2 key={i}><Inline text={block.text} /></h2>
            ) : (
              <h3 key={i}><Inline text={block.text} /></h3>
            );
          case 'list': {
            const Tag = block.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i}>
                {block.items.map((item, j) => (
                  <li key={j}><Inline text={item} /></li>
                ))}
              </Tag>
            );
          }
          case 'table':
            return (
              <div key={i} className="table-wrap">
                <table>
                  <thead>
                    <tr>{block.head.map((cell, j) => <th key={j}><Inline text={cell} /></th>)}</tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, r) => (
                      <tr key={r}>{row.map((cell, c) => <td key={c}><Inline text={cell} /></td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          case 'paragraph':
            return <p key={i}><Inline text={block.text} /></p>;
        }
      })}
    </div>
  );
}
