/** Сигнал для ConfettiHost: `burst()` — хлопок за верный ответ, `celebrate()` — салют за идеальный коммит. */
export type ConfettiKind = 'burst' | 'celebrate';

const listeners = new Set<(kind: ConfettiKind) => void>();

export function burst() {
  listeners.forEach((l) => l('burst'));
}

export function celebrate() {
  listeners.forEach((l) => l('celebrate'));
}

export function subscribeConfetti(listener: (kind: ConfettiKind) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
