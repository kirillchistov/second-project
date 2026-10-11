/**
 * Собирает весь контент в один JSON — его мобильное приложение скачивает как OTA-обновление.
 * Версия — хеш содержимого: если контент не менялся, версия тоже не меняется.
 *
 *   npm run bundle -w @rr/content   →   packages/content/dist/content.json
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentBundle } from '../src/bundle.ts';
import { LEGACY } from '../src/legacy.ts';
import { CONTENT_ROOT, loadExercises, loadQuestions } from '../src/node.ts';
import { LEVELS, TOPICS } from '../src/topics.ts';
import { UNITS } from '../src/units.ts';

const SCHEMA_VERSION = 1;

const content = {
  levels: LEVELS,
  topics: TOPICS,
  units: UNITS,
  questions: loadQuestions(),
  exercises: loadExercises(),
  legacy: LEGACY,
};

const version = createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 12);
const bundle: ContentBundle = { schemaVersion: SCHEMA_VERSION, version, generatedAt: new Date().toISOString(), ...content };

const outDir = join(CONTENT_ROOT, 'dist');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'content.json');
writeFileSync(outFile, JSON.stringify(bundle));

console.log(
  `content ${version}: ${content.questions.length} вопросов, ${content.exercises.length} упражнений → ${outFile}`,
);
