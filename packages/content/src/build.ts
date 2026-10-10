import { parseQuestions } from './parse.ts';
import type { Level, Question } from './types.ts';

export const LEVEL_ORDER: Level[] = ['junior', 'middle', 'senior'];

function levelOf(path: string): Level {
  const name = path.split('/').at(-1) ?? '';
  const level = name.split('-')[0] as Level;
  if (!LEVEL_ORDER.includes(level)) throw new Error(`Неизвестный уровень в имени файла: ${path}`);
  return level;
}

/**
 * Собирает список вопросов из Markdown-файлов `<level>-<n>.md` (путь → содержимое).
 * Порядок: по уровню, внутри уровня — по имени файла, затем по порядку в файле.
 * Не зависит от бандлера: веб передаёт результат `import.meta.glob`, Node — прочитанные файлы.
 */
export function buildQuestions(files: Record<string, string>): Question[] {
  const sortedPaths = Object.keys(files).sort((a, b) => {
    const byLevel = LEVEL_ORDER.indexOf(levelOf(a)) - LEVEL_ORDER.indexOf(levelOf(b));
    return byLevel !== 0 ? byLevel : a.localeCompare(b, 'en', { numeric: true });
  });

  return sortedPaths
    .flatMap((path) => parseQuestions(files[path], levelOf(path)))
    .map((q, i) => ({ ...q, number: i + 1 }));
}
