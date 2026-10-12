import { Highlight, type PrismTheme } from 'prism-react-renderer';

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

export function CodeLines({
  code,
  language,
  selectedLine,
  marked,
  onLine,
}: {
  code: string;
  language: string;
  selectedLine?: number;
  marked?: ReadonlyMap<number, 'correct' | 'wrong'>;
  onLine?: (line: number) => void;
}) {
  return (
    <div className="code-lines">
      <Highlight code={code.replace(/\n$/, '')} language={LANGUAGE_ALIASES[language] ?? (language || 'tsx')} theme={theme}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre>
            {tokens.map((line, index) => {
              const number = index + 1;
              const mark = marked?.get(number);
              const lineProps = getLineProps({ line });
              return (
                <div
                  key={number}
                  {...lineProps}
                  className={[
                    lineProps.className,
                    'code-lines__row',
                    selectedLine === number ? 'is-selected' : '',
                    mark ? `is-${mark}` : '',
                    onLine ? 'is-interactive' : '',
                  ].filter(Boolean).join(' ')}
                  role={onLine ? 'button' : undefined}
                  tabIndex={onLine ? 0 : undefined}
                  onClick={onLine ? () => onLine(number) : undefined}
                  onKeyDown={
                    onLine
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onLine(number);
                          }
                        }
                      : undefined
                  }
                >
                  <span className="code-lines__n">{number}</span>
                  <span className="code-lines__code">
                    {line.map((token, tokenIndex) => (
                      <span key={tokenIndex} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
