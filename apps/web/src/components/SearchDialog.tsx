import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { searchQuestions } from '../data/questions';
import { LevelBadge } from './Badges';
import { IconSearch } from './Icons';

export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const results = query.trim() ? searchQuestions(query) : [];

  function go(slug: string) {
    onClose();
    setQuery('');
    navigate(`/questions/${slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (results[active]) go(results[active].slug);
      else if (query.trim()) {
        onClose();
        navigate(`/questions?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="search-dialog"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-label="Поиск по вопросам"
    >
      <div className="search-dialog__field">
        <IconSearch />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Поиск: useEffect, гидрация, 42…"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="search-results"
          aria-activedescendant={results[active] ? `sr-${results[active].slug}` : undefined}
        />
        <kbd>Esc</kbd>
      </div>
      {query.trim() && (
        <ul id="search-results" role="listbox" className="search-dialog__results">
          {results.length === 0 && <li className="search-dialog__empty">Ничего не нашлось</li>}
          {results.map((q, i) => (
            <li
              key={q.slug}
              id={`sr-${q.slug}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'is-active' : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(q.slug)}
            >
              <span className="search-dialog__num">{q.number}</span>
              <span className="search-dialog__title">{q.title}</span>
              <LevelBadge level={q.level} />
            </li>
          ))}
        </ul>
      )}
      {!query.trim() && (
        <p className="search-dialog__hint">Ищите по словам из вопроса и ответа или по номеру вопроса.</p>
      )}
    </dialog>
  );
}
