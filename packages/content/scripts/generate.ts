/**
 * Генерация черновиков упражнений по вопросам банка с помощью Claude.
 *
 *   npm run generate -w @rr/content -- --only keys,rules-of-hooks
 *   npm run generate -w @rr/content -- --topic hooks --limit 5
 *   npm run generate -w @rr/content -- --dry-run --only keys     # показать промпты, без запросов
 *   npm run generate -w @rr/content -- --model claude-sonnet-5-5 --out pilot/sonnet   # другой автор, своя папка
 *   npm run generate -w @rr/content -- --batch                   # через Batch API: вдвое дешевле, ответ до суток
 *   npm run generate -w @rr/content -- --batch --resume          # дождаться пакетов, если скрипт прервали
 *
 * Для каждого вопроса два прохода: генератор пишет упражнения (structured outputs → проверка схемой),
 * затем ревьюер проверяет правильность ответов и правит или отбрасывает. В живом режиме то, что не прошло
 * схему, генератор один раз исправляет; в пакетном такие упражнения отбрасываются (второй круг — ещё сутки).
 * Результат — exercises/drafts/<slug>.yaml с замечаниями ревьюера в комментариях. В банк упражнения попадают
 * только после вычитки человеком: npm run approve -w @rr/content.
 *
 * Ключ: ANTHROPIC_API_KEY в .env в корне репозитория (см. .env.example), в окружении или профиль `ant auth login`.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { Exercise } from '../src/exercises.ts';
import { CONTENT_ROOT, DRAFTS_DIR, loadDrafts, loadExercises, loadQuestions } from '../src/node.ts';
import type { Question } from '../src/types.ts';
import { ask, batchRequest, client, collect, GenerationError, printUsage, runPool, errorText } from './claude.ts';
import {
  applyReviews,
  fromFlat,
  generationOutput,
  generatorSystemPrompt,
  generatorUserPrompt,
  renderDraft,
  REVIEWER_SYSTEM_PROMPT,
  reviewerUserPrompt,
  reviewOutput,
  reviewsFromOutput,
  uniqueIds,
  validateWire,
  type Review,
  type WireExercise,
} from './generation.ts';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    topic: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '3' },
    /** Кто пишет упражнения */
    model: { type: 'string', default: 'claude-opus-5-5' },
    /** Кто проверяет: ревьюер должен быть не слабее автора — неверный ответ в тренажёре хуже пропуска */
    'review-model': { type: 'string', default: 'claude-opus-5-5' },
    /** Куда писать черновики (по умолчанию exercises/drafts) — для сравнения прогонов */
    out: { type: 'string' },
    force: { type: 'boolean', default: false },
    batch: { type: 'boolean', default: false },
    resume: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    /** JSON { slug: "что изменилось" } — режим актуализации, его пишет radar.ts */
    context: { type: 'string' },
  },
});

const MODEL = args.model!;
const REVIEW_MODEL = args['review-model']!;
const OUT_DIR = args.out ?? DRAFTS_DIR;
const BATCH_STATE = join(OUT_DIR, '.batch.json');
/** Что изменилось по вопросу в новых версиях библиотек — подмешивается в промпты генератора и ревьюера */
const updates: Record<string, string> = args.context ? JSON.parse(readFileSync(args.context, 'utf8')) : {};
const questions = loadQuestions();
const questionBySlug = new Map(questions.map((q) => [q.slug, q]));
const approved = loadExercises();
const drafts = loadDrafts();

let selected = questions.filter((q) => {
  if (args.only) return args.only.split(',').map((s) => s.trim()).includes(q.slug);
  if (args.topic) return q.topic === args.topic;
  return true;
});
// Без --force не трогаем вопросы, по которым уже есть черновик или упражнения в банке.
// В режиме актуализации (--context) берём ровно те вопросы, что указал радар.
if (args.context) selected = selected.filter((q) => updates[q.slug] && (args.force || !existsSync(join(OUT_DIR, `${q.slug}.yaml`))));
else if (!args.force) {
  const covered = new Set(approved.map((e) => e.question));
  selected = selected.filter((q) => !covered.has(q.slug) && !existsSync(join(OUT_DIR, `${q.slug}.yaml`)));
}
if (args.limit) selected = selected.slice(0, Number(args.limit));

// Примеры для генератора — вручную написанные упражнения: задают стиль и уровень
const system = generatorSystemPrompt(approved);
const existingFor = (q: Question) => approved.filter((e) => e.question === q.slug);

if (args['dry-run']) {
  console.log(`Вопросов к генерации: ${selected.length}\n`);
  console.log(`── system (${system.length} символов) ──\n${system}\n`);
  for (const q of selected.slice(0, 1)) console.log(`── user: ${q.slug} ──\n${generatorUserPrompt(q, existingFor(q), updates[q.slug])}`);
  process.exit(0);
}

// ─── Общие шаги ──────────────────────────────────────────────────────────────

function generationMessages(q: Question): Anthropic.MessageParam[] {
  return [{ role: 'user', content: generatorUserPrompt(q, existingFor(q), updates[q.slug]) }];
}

function reviewMessages(q: Question, wires: readonly WireExercise[]): Anthropic.MessageParam[] {
  return [{ role: 'user', content: reviewerUserPrompt(q, wires, updates[q.slug]) }];
}

/** Оставляет то, что прошло схему банка; остальное — в список отброшенного. */
function keepValid(q: Question, wires: WireExercise[], dropped: string[]): WireExercise[] {
  const { valid, invalid } = validateWire(wires, q.slug);
  for (const bad of invalid) {
    dropped.push(bad.id);
    console.warn(`  ${q.slug}: ${bad.id} не прошло схему — отброшено`);
  }
  const ids = new Set(valid.map((e) => e.id));
  return wires.filter((w) => ids.has(w.id));
}

/** Применяет ревью и пишет черновик. Возвращает короткий итог для лога. */
function finalize(q: Question, wires: readonly WireExercise[], reviews: readonly Review[], dropped: string[]): string {
  const { kept, notes, dropped: rejected } = applyReviews(wires, reviews);
  dropped.push(...rejected);
  const final = validateWire(kept, q.slug);
  for (const bad of final.invalid) {
    dropped.push(bad.id);
    console.warn(`  ${q.slug}: исправление ревьюера для ${bad.id} не прошло схему — отброшено`);
  }

  // id уникальны относительно банка и других черновиков
  const taken = new Set([...approved, ...drafts].map((e) => e.id));
  const exercises: Exercise[] = uniqueIds(final.valid, taken);
  mkdirSync(OUT_DIR, { recursive: true });
  const model = MODEL === REVIEW_MODEL ? MODEL : `${MODEL}, ревьюер ${REVIEW_MODEL}`;
  writeFileSync(
    join(OUT_DIR, `${q.slug}.yaml`),
    renderDraft({ question: q, exercises, notes, dropped, model, date: new Date().toISOString().slice(0, 10) }),
  );
  drafts.push(...exercises);
  return `${exercises.length} упр.${dropped.length ? `, отброшено ${dropped.length}` : ''}`;
}

// ─── Живой режим: запрос за запросом ─────────────────────────────────────────

async function generateLive(q: Question): Promise<string> {
  const dropped: string[] = [];
  const messages: Anthropic.Beta.BetaMessageParam[] = generationMessages(q);
  const first = await ask(MODEL, system, messages, generationOutput);
  let wires = first.parsed.exercises.map(fromFlat);
  let checked = validateWire(wires, q.slug);

  // Одна попытка исправить то, что не прошло схему. Ответ модели передаём целиком — с блоками thinking
  if (checked.invalid.length) {
    messages.push({ role: 'assistant', content: first.content });
    messages.push({
      role: 'user',
      content: `Эти упражнения не прошли проверку схемы:\n${checked.invalid.map((i) => `- ${i.id}: ${i.error}`).join('\n')}\nВерни полный исправленный список упражнений.`,
    });
    wires = (await ask(MODEL, system, messages, generationOutput)).parsed.exercises.map(fromFlat);
  }
  wires = keepValid(q, wires, dropped);
  if (wires.length === 0) throw new GenerationError('ни одно упражнение не прошло схему');

  const review = await ask(REVIEW_MODEL, REVIEWER_SYSTEM_PROMPT, reviewMessages(q, wires), reviewOutput);
  return finalize(q, wires, reviewsFromOutput(review.parsed), dropped);
}

async function runLive(list: Question[]): Promise<string[]> {
  return runPool(list, Number(args.concurrency), (q) => q.slug, generateLive);
}

// ─── Пакетный режим: Batch API ───────────────────────────────────────────────

interface BatchState {
  slugs: string[];
  generation?: string;
  review?: string;
}

function saveState(state: BatchState) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(BATCH_STATE, JSON.stringify(state, null, 2));
}

async function runBatch(list: Question[]): Promise<string[]> {
  let state: BatchState;
  if (args.resume) {
    if (!existsSync(BATCH_STATE)) throw new GenerationError(`нечего продолжать: нет ${BATCH_STATE}`);
    state = JSON.parse(readFileSync(BATCH_STATE, 'utf8')) as BatchState;
  } else {
    if (existsSync(BATCH_STATE)) throw new GenerationError(`есть незавершённый прогон — продолжите с --resume или удалите ${BATCH_STATE}`);
    state = { slugs: list.map((q) => q.slug) };
  }
  const qs = state.slugs.map((slug) => questionBySlug.get(slug)!);
  const failed: string[] = [];

  // 1. Генерация
  if (!state.generation) {
    const batch = await client.messages.batches.create({
      requests: qs.map((q) => batchRequest(q.slug, MODEL, system, generationMessages(q), generationOutput)),
    });
    state.generation = batch.id;
    saveState(state);
    console.log(`Пакет генерации отправлен: ${batch.id}. Можно прервать скрипт и потом продолжить с --resume.`);
  }
  const generated = await collect(state.generation, MODEL, generationOutput, 'генерация');

  const wiresBySlug = new Map<string, WireExercise[]>();
  const droppedBySlug = new Map<string, string[]>();
  for (const q of qs) {
    const result = generated.get(q.slug);
    if (!result || result instanceof Error) {
      failed.push(q.slug);
      console.error(`✗ ${q.slug}: генерация — ${result?.message ?? 'нет ответа'}`);
      continue;
    }
    const dropped: string[] = [];
    const wires = keepValid(q, result.exercises.map(fromFlat), dropped);
    if (wires.length === 0) {
      failed.push(q.slug);
      console.error(`✗ ${q.slug}: ни одно упражнение не прошло схему`);
      continue;
    }
    wiresBySlug.set(q.slug, wires);
    droppedBySlug.set(q.slug, dropped);
  }

  // 2. Ревью
  if (!state.review) {
    const batch = await client.messages.batches.create({
      requests: [...wiresBySlug].map(([slug, wires]) =>
        batchRequest(slug, REVIEW_MODEL, REVIEWER_SYSTEM_PROMPT, reviewMessages(questionBySlug.get(slug)!, wires), reviewOutput),
      ),
    });
    state.review = batch.id;
    saveState(state);
    console.log(`Пакет ревью отправлен: ${batch.id}.`);
  }
  const reviewed = await collect(state.review, REVIEW_MODEL, reviewOutput, 'ревью');

  // 3. Черновики. Если ревью для вопроса не пришло, упражнения всё равно сохраняются — с пометкой для человека
  for (const [slug, wires] of wiresBySlug) {
    const result = reviewed.get(slug);
    const reviews = result && !(result instanceof Error) ? reviewsFromOutput(result) : [];
    if (result instanceof Error) console.warn(`  ${slug}: ревью не получено (${result.message}) — упражнения помечены для ручной проверки`);
    console.log(`✓ ${slug}: ${finalize(questionBySlug.get(slug)!, wires, reviews, droppedBySlug.get(slug)!)}`);
  }

  rmSync(BATCH_STATE);
  return failed;
}

// ─── Запуск ──────────────────────────────────────────────────────────────────

if (selected.length === 0 && !args.resume) {
  console.log('Нечего генерировать: по выбранным вопросам уже есть черновики (перегенерировать — --force).');
  process.exit(0);
}

console.log(
  `${args.batch ? 'Пакетная генерация' : 'Генерация'} по ${args.resume ? 'сохранённому прогону' : `${selected.length} вопросам`}: ` +
    `пишет ${MODEL}, проверяет ${REVIEW_MODEL}${args.batch ? '' : `, параллельно ${args.concurrency}`}. ` +
    `Черновики → ${OUT_DIR.replace(CONTENT_ROOT + '/', '')}`,
);

let failed: string[] = [];
try {
  failed = args.batch ? await runBatch(selected) : await runLive(selected);
} catch (error) {
  console.error(`✗ ${errorText(error)}`);
  process.exitCode = 1;
}
printUsage();
if (failed.length) {
  console.log(`Не получилось: ${failed.join(', ')} — можно перезапустить с --only.`);
  process.exitCode = 1;
}
