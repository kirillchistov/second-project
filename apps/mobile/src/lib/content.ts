import type { ContentBundle } from '@rr/content';
import { buildPath, itemsById } from '@rr/core';

// Бандл собирается командой `npm run bundle:content` (её запускают скрипты start/ios).
// В фазе 4 он будет приходить OTA-обновлением, а вшитый станет запасным вариантом.
export const CONTENT: ContentBundle = require('@rr/content/bundle.json');

export const PATH = buildPath(CONTENT);
export const LESSONS = PATH.flatMap((unit) => unit.lessons);
export const lessonById = new Map(LESSONS.map((l) => [l.id, l]));
export const ITEMS = itemsById(CONTENT);
export const topicTitle = new Map(CONTENT.topics.map((t) => [t.id, t.title]));
