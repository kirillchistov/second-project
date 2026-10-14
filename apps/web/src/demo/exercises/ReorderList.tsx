import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';

/** Расстояние между элементами списка — то же, что gap у `.arrange` */
const GAP = 8;

interface Drag {
  id: number;
  from: number;
  to: number;
  startY: number;
  dy: number;
  /** Высоты элементов на момент захвата: по ним считается, куда встанет перетаскиваемый */
  heights: number[];
}

/** Куда встанет элемент `from`, сдвинутый на dy: считаем, сколько соседей он «перешагнул» своей серединой. */
function targetIndex(heights: number[], from: number, dy: number): number {
  let to = from;
  if (dy > 0) {
    let travelled = dy;
    for (let i = from + 1; i < heights.length && travelled > (heights[i] + GAP) / 2; i++) {
      to = i;
      travelled -= heights[i] + GAP;
    }
  } else {
    let travelled = -dy;
    for (let i = from - 1; i >= 0 && travelled > (heights[i] + GAP) / 2; i--) {
      to = i;
      travelled -= heights[i] + GAP;
    }
  }
  return to;
}

function move<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Список, который можно переупорядочить перетаскиванием за ручку (мышь, палец, перо — pointer events)
 * или с клавиатуры: фокус на ручке и стрелки вверх-вниз. Соседи плавно расступаются во время перетаскивания.
 */
export function ReorderList({
  ids,
  onChange,
  disabled,
  describe,
  renderItem,
}: {
  ids: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
  /** Текст элемента для подписи ручки и объявления скринридеру */
  describe: (id: number) => string;
  renderItem: (id: number, index: number, handle: ReactNode) => ReactNode;
}) {
  const itemRefs = useRef(new Map<number, HTMLLIElement>());
  const handleRefs = useRef(new Map<number, HTMLButtonElement>());
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState('');
  // Кадр после отпускания: элемент уже на новом месте в DOM, сдвиги обнуляются без анимации,
  // иначе он «отлетел» бы к старой позиции и вернулся
  const [dropping, setDropping] = useState(false);
  const focusAfterMove = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (focusAfterMove.current === null) return;
    handleRefs.current.get(focusAfterMove.current)?.focus();
    focusAfterMove.current = null;
  });

  function onPointerDown(e: PointerEvent<HTMLButtonElement>, id: number, index: number) {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const heights = ids.map((item) => itemRefs.current.get(item)?.offsetHeight ?? 0);
    setDrag({ id, from: index, to: index, startY: e.clientY, dy: 0, heights });
  }

  function onPointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    setDrag({ ...drag, dy, to: targetIndex(drag.heights, drag.from, dy) });
  }

  function onPointerUp() {
    if (!drag) return;
    if (drag.to !== drag.from) {
      onChange(move(ids, drag.from, drag.to));
      setDropping(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setDropping(false)));
      setAnnounce(`${describe(drag.id)}: позиция ${drag.to + 1} из ${ids.length}`);
    }
    setDrag(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, id: number, index: number) {
    const delta = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
    if (!delta || disabled) return;
    e.preventDefault();
    const to = index + delta;
    if (to < 0 || to >= ids.length) return;
    focusAfterMove.current = id;
    onChange(move(ids, index, to));
    setAnnounce(`${describe(id)}: позиция ${to + 1} из ${ids.length}`);
  }

  /** Сдвиг соседа, пока тащат другой элемент: освобождаем место под перетаскиваемый */
  function shiftOf(index: number): number {
    if (!drag || index === drag.from) return 0;
    const size = drag.heights[drag.from] + GAP;
    if (drag.from < index && index <= drag.to) return -size;
    if (drag.to <= index && index < drag.from) return size;
    return 0;
  }

  return (
    <>
      <ol className={`reorder ${drag ? 'is-dragging' : ''} ${dropping ? 'is-dropping' : ''}`}>
        {ids.map((id, index) => {
          const dragging = drag?.id === id;
          const handle = disabled ? null : (
            <button
              type="button"
              ref={(node) => {
                if (node) handleRefs.current.set(id, node);
                else handleRefs.current.delete(id);
              }}
              className="reorder__handle"
              aria-label={`Переместить: ${describe(id)}. Позиция ${index + 1} из ${ids.length}. Стрелки вверх и вниз`}
              onPointerDown={(e) => onPointerDown(e, id, index)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={(e) => onKeyDown(e, id, index)}
            >
              <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
                {[4, 10, 16].flatMap((y) => [3, 11].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.8" />))}
              </svg>
            </button>
          );
          return (
            <li
              key={id}
              ref={(node) => {
                if (node) itemRefs.current.set(id, node);
                else itemRefs.current.delete(id);
              }}
              className={`reorder__item ${dragging ? 'is-lifted' : ''}`}
              style={{ transform: `translateY(${dragging ? drag.dy : shiftOf(index)}px)` }}
            >
              {renderItem(id, index, handle)}
            </li>
          );
        })}
      </ol>
      <p className="visually-hidden" aria-live="polite">
        {announce}
      </p>
    </>
  );
}
