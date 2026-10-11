/**
 * Fibi — маленький Fiber-узел, маскот приложения. Пока только реплики;
 * анимированный персонаж появится в фазе 3.
 */
const CORRECT = ['Коммит принят ✓', 'Чистый рендер!', 'Без лишних ререндеров', 'Ревью пройдено', 'Так держать'];
const COMBO = ['Ты в потоке: {n} подряд', '{n} подряд — это уже паттерн', 'Комбо {n}! Fiber гордится'];
const WRONG = ['Баг пойман — это тоже прогресс', 'Вернёмся к этому в конце урока', 'Ошибка ушла в backlog, закроем позже'];

function pick(list: string[], seed: number): string {
  return list[Math.abs(seed) % list.length];
}

export function fibiLine(correct: boolean, combo: number, seed: number): string {
  if (!correct) return pick(WRONG, seed);
  if (combo >= 3) return pick(COMBO, seed).replace('{n}', String(combo));
  return pick(CORRECT, seed);
}

export function fibiFace(mood: 'happy' | 'sad' | 'proud' | 'idle'): string {
  return { happy: '(◕‿◕)', sad: '(•︵•)', proud: '(⌐■‿■)', idle: '(•‿•)' }[mood];
}
