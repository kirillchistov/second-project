import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildQuestions } from './build.ts';
import { parseExercises, type Exercise } from './exercises.ts';
import type { Question } from './types.ts';

/** Корень пакета: здесь лежат `questions/` и `exercises/`. */
export const CONTENT_ROOT = join(import.meta.dirname, '..');

function readDir(dir: string, ext: string): [name: string, raw: string][] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(ext))
    .sort()
    .map((name) => [name, readFileSync(join(dir, name), 'utf8')]);
}

/** Загрузка вопросов в Node (скрипты, тесты, сборка бандла для мобильного приложения). */
export function loadQuestions(dir = join(CONTENT_ROOT, 'questions')): Question[] {
  return buildQuestions(Object.fromEntries(readDir(dir, '.md')));
}

export function loadExercises(dir = join(CONTENT_ROOT, 'exercises')): Exercise[] {
  return readDir(dir, '.yaml').flatMap(([name, raw]) => parseExercises(raw, name));
}
