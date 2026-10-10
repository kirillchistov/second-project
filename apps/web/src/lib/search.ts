const EVENT = 'rr:open-search';

/** Открыть поиск из любого места приложения (диалог живёт в Layout). */
export function openSearch() {
  window.dispatchEvent(new Event(EVENT));
}

export function onOpenSearch(handler: () => void): () => void {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
