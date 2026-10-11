/**
 * Правка YAML-файлов банка на уровне текста: комментарии вычитки и порядок упражнений сохраняются.
 */

/**
 * Удаляет упражнения с указанными id вместе с комментариями прямо над ними.
 * Возвращает новый текст и id, которые действительно нашлись.
 */
export function removeExercises(text: string, ids: ReadonlySet<string>): { text: string; removed: string[] } {
  const lines = text.split('\n');
  const out: string[] = [];
  const removed: string[] = [];
  let pendingComments: string[] = [];
  let skipping = false;

  for (const line of lines) {
    const start = line.match(/^- id: (\S+)/);
    if (start) {
      skipping = ids.has(start[1]);
      if (skipping) removed.push(start[1]);
      else out.push(...pendingComments, line);
      pendingComments = [];
      continue;
    }
    // Комментарий на верхнем уровне относится к следующему упражнению — решаем, когда его встретим
    if (/^#/.test(line)) {
      pendingComments.push(line);
      continue;
    }
    if (skipping && (line.startsWith('  ') || line.trim() === '')) {
      if (line.trim() === '') out.push(line);
      continue;
    }
    skipping = false;
    out.push(...pendingComments, line);
    pendingComments = [];
  }
  out.push(...pendingComments);
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n'), removed };
}
