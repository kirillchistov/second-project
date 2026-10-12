const CORRECT = ['Коммит принят', 'Чистый рендер', 'Ревью пройдено', 'Так держать'];
const COMBO = ['{n} подряд — это уже паттерн', 'Комбо {n}'];
const WRONG = ['Вернёмся к этому в конце урока', 'Ошибка ушла в повторение'];

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length];
}

export function feedbackLine(correct: boolean, combo: number, seed: number): string {
  if (!correct) return pick(WRONG, seed);
  if (combo >= 3) return pick(COMBO, seed).replace('{n}', String(combo));
  return pick(CORRECT, seed);
}
