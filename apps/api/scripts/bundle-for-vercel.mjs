/**
 * Только для сборки на Vercel: собирает src/index.ts в один файл src/index.js со всеми
 * зависимостями внутри (@rr/core, @rr/content и npm-пакеты) и удаляет src/index.ts.
 *
 * Почему: @rr/core и @rr/content — пакеты npm workspaces, их «." в package.json указывает
 * прямо на src/index.ts. Раздатчик функций Vercel трассирует файлы в границах Root Directory
 * (apps/api) и не всегда забирает исходники соседних пакетов монорепозитория — тогда функция
 * падает в рантайме с ERR_MODULE_NOT_FOUND на node_modules/@rr/core/src/index.ts. Если собрать
 * всё в один файл заранее, трассировщику нечего искать за пределами apps/api.
 *
 * Локальная разработка (main.ts) этот скрипт не использует и не вызывает.
 */
import { build } from 'esbuild';
import { rmSync } from 'node:fs';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'src/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
});

rmSync('src/index.ts');
console.log('vercel: src/index.ts собран в src/index.js (зависимости монорепозитория инлайнены)');
