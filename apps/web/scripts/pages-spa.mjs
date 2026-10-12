import { copyFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// GitHub Pages отдаёт 404.html для неизвестных путей, сохраняя адрес.
// Копия index.html позволяет BrowserRouter открыть /lesson/... после обновления страницы.
const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
writeFileSync(resolve(dist, '.nojekyll'), '');
