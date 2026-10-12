import { useState } from 'react';
import { shuffle } from '@rr/core';

export function useShuffledOrder(length: number): number[] {
  const [order] = useState(() => shuffle([...Array(length).keys()]));
  return order;
}
