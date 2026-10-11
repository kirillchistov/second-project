import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildQuestions } from './build.ts';
import { parseExercises, type Exercise } from './exercises.ts';
import { parseRubrics, type Rubric } from './rubrics.ts';
import type { Question } from './types.ts';

/** Корень пакета: здесь лежат `questions/` и `exercises/`. */
export const CONTENT_ROOT = join(import.meta.dirname, '..');

/** Рубрики устных ответов: rubrics/<тема>.yaml. */
export const RUBRICS_DIR = join(CONTENT_ROOT, 'rubrics');

export function loadRubrics(dir = RUBRICS_DIR): Rubric[] {
  if (!existsSync(dir)) return [];
  return readDir(dir, '.yaml').flatMap(([name, raw]) => parseRubrics(raw, `rubrics/${name}`));
}

/** Черновики от генератора: в банк не входят, пока их не вычитали и не приняли. */
export const DRAFTS_DIR = join(CONTENT_ROOT, 'exercises', 'drafts');

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

/** Черновики по вопросам: slug → упражнения. Проверяются той же схемой, что и банк. */
export function loadDraftFiles(dir = DRAFTS_DIR): Map<string, Exercise[]> {
  if (!existsSync(dir)) return new Map();
  return new Map(readDir(dir, '.yaml').map(([name, raw]) => [name.replace(/\.yaml$/, ''), parseExercises(raw, `drafts/${name}`)]));
}

export function loadDrafts(dir = DRAFTS_DIR): Exercise[] {
  return [...loadDraftFiles(dir).values()].flat();
}
