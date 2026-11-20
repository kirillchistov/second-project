import { parseQuestions } from './parse.ts';
import type { Level, Question } from './types.ts';

export const LEVEL_ORDER: Level[] = ['junior', 'middle', 'senior'];

function levelOf(path: string, levelOrder: readonly string[]): Level {
  const name = path.split('/').at(-1) ?? '';
  const level = name.split('-')[0] ?? '';
  if (!levelOrder.includes(level)) throw new Error(`Неизвестный уровень в имени файла: ${path}`);
  return level;
}

/**
 * Собирает список вопросов из Markdown-файлов `<level>-<n>.md` (путь → содержимое).
 * Порядок: по уровню, внутри уровня — по имени файла, затем по порядку в файле.
 * Не зависит от бандлера: веб передаёт результат `import.meta.glob`, Node — прочитанные файлы.
 */
export function buildQuestions(files: Record<string, string>, levelOrder: readonly string[] = LEVEL_ORDER): Question[] {
  const sortedPaths = Object.keys(files).sort((a, b) => {
    const byLevel = levelOrder.indexOf(levelOf(a, levelOrder)) - levelOrder.indexOf(levelOf(b, levelOrder));
    return byLevel !== 0 ? byLevel : a.localeCompare(b, 'en', { numeric: true });
  });

  return sortedPaths
    .flatMap((path) => parseQuestions(files[path], levelOf(path, levelOrder)))
    .map((q, i) => ({ ...q, number: i + 1 }));
}
