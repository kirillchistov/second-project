import { shuffle } from '@rr/core';
import { useState } from 'react';

/**
 * Порядок показа вариантов: перемешивается один раз на показ задания.
 * В контенте верный ответ может стоять где угодно (часто первым) — без перемешивания его позиция стала бы подсказкой.
 */
export function useShuffledOrder(count: number): number[] {
  const [order] = useState(() => shuffle(Array.from({ length: count }, (_, i) => i)));
  return order;
}
