import { Highlight, type PrismTheme } from 'prism-react-renderer';
import { useState } from 'react';
import { IconCheck, IconCopy } from './Icons';

// Цвета берутся из CSS-переменных, поэтому подсветка сама переключается со светлой темы на тёмную.
const theme: PrismTheme = {
  plain: { color: 'var(--code-text)', backgroundColor: 'transparent' },
  styles: [
    { types: ['comment', 'prolog', 'doctype', 'cdata'], style: { color: 'var(--code-comment)', fontStyle: 'italic' } },
    { types: ['punctuation', 'operator'], style: { color: 'var(--code-punctuation)' } },
    { types: ['keyword', 'atrule', 'important'], style: { color: 'var(--code-keyword)' } },
    { types: ['string', 'char', 'attr-value', 'regex', 'template-string', 'url'], style: { color: 'var(--code-string)' } },
    { types: ['number', 'boolean', 'constant', 'symbol'], style: { color: 'var(--code-number)' } },
    { types: ['function', 'method'], style: { color: 'var(--code-function)' } },
    { types: ['tag', 'class-name', 'maybe-class-name', 'builtin'], style: { color: 'var(--code-tag)' } },
    { types: ['attr-name', 'property', 'selector'], style: { color: 'var(--code-attr)' } },
  ],
};

const LANGUAGE_ALIASES: Record<string, string> = { ts: 'typescript', text: 'markup', bash: 'clike' };
const LABELS: Record<string, string> = { tsx: 'TSX', ts: 'TS', typescript: 'TS', jsx: 'JSX', bash: 'Terminal', text: 'Структура', css: 'CSS' };

export function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // буфер обмена недоступен — ничего не делаем
    }
  }

  return (
    <div className="code-block">
      <div className="code-block__bar">
        <span>{LABELS[language] ?? (language || 'Код')}</span>
        <button type="button" className="code-block__copy" onClick={copy} aria-label="Скопировать код">
          {copied ? <IconCheck /> : <IconCopy />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
      <Highlight code={code} language={LANGUAGE_ALIASES[language] ?? (language || 'markup')} theme={theme}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={className} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, j) => (
                  <span key={j} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
