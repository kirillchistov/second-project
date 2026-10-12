import type { ReactNode } from 'react';
import { Inline } from '../../components/Markdown';

export function Prompt({ label, text }: { label: string; text: string }) {
  return (
    <header className="prompt">
      <p className="prompt__label">{label}</p>
      <h2 className="prompt__text">
        <Inline text={text} />
      </h2>
    </header>
  );
}

export function ChoiceButton({
  selected,
  state,
  disabled,
  onClick,
  children,
  mono = false,
}: {
  selected?: boolean;
  state?: 'correct' | 'wrong';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <button
      type="button"
      className={`choice ${selected ? 'is-selected' : ''} ${state ? `is-${state}` : ''} ${mono ? 'is-mono' : ''}`}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
