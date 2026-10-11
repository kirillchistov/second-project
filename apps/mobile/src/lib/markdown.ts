export type Segment = { text: string; style?: 'code' | 'bold' | 'italic' | 'link' };

const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))/g;

/** Разбивает строку с инлайн-разметкой Markdown на сегменты для вложенных <Text>. */
export function inlineSegments(source: string): Segment[] {
  return source
    .split(INLINE)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith('`')) return { text: part.slice(1, -1), style: 'code' };
      if (part.startsWith('**')) return { text: part.slice(2, -2), style: 'bold' };
      if (part.startsWith('[')) return { text: part.slice(1, part.indexOf('](')), style: 'link' };
      if (part.startsWith('*') && part.length > 2) return { text: part.slice(1, -1), style: 'italic' };
      return { text: part };
    });
}
