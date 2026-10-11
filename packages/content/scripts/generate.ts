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
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import type { Exercise } from '../src/exercises.ts';
import { CONTENT_ROOT, DRAFTS_DIR, loadDrafts, loadExercises, loadQuestions } from '../src/node.ts';
import type { Question } from '../src/types.ts';
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
  },
});

const MODEL = args.model!;
const REVIEW_MODEL = args['review-model']!;
const OUT_DIR = args.out ?? DRAFTS_DIR;
const BATCH_STATE = join(OUT_DIR, '.batch.json');
const EFFORT = 'high' as const;
const MAX_TOKENS = 64000;

// $ за 1M токенов — для оценки стоимости прогона. Запись в кеш — 1.25× от входа, Batch API — скидка 50%.
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

const questions = loadQuestions();
const questionBySlug = new Map(questions.map((q) => [q.slug, q]));
const approved = loadExercises();
const drafts = loadDrafts();

let selected = questions.filter((q) => {
  if (args.only) return args.only.split(',').map((s) => s.trim()).includes(q.slug);
  if (args.topic) return q.topic === args.topic;
  return true;
});
// Без --force не трогаем вопросы, по которым уже есть черновик
if (!args.force) selected = selected.filter((q) => !existsSync(join(OUT_DIR, `${q.slug}.yaml`)));
if (args.limit) selected = selected.slice(0, Number(args.limit));

// Примеры для генератора — вручную написанные упражнения: задают стиль и уровень
const system = generatorSystemPrompt(approved);
const existingFor = (q: Question) => approved.filter((e) => e.question === q.slug);

if (args['dry-run']) {
  console.log(`Вопросов к генерации: ${selected.length}\n`);
  console.log(`── system (${system.length} символов) ──\n${system}\n`);
  for (const q of selected.slice(0, 1)) console.log(`── user: ${q.slug} ──\n${generatorUserPrompt(q, existingFor(q))}`);
  process.exit(0);
}

// Ключ организации без привязки к workspace требует явный workspace в заголовке
const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});

class GenerationError extends Error {}

// ─── Учёт расхода ────────────────────────────────────────────────────────────

type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number; discount: number };
/** Расход по моделям и режимам: автор и ревьюер могут быть разными, пакеты считаются со скидкой */
const usage = new Map<string, Usage>();

function track(model: string, u: Anthropic.Usage | Anthropic.Beta.BetaUsage, batch: boolean) {
  const key = batch ? `${model} (batch)` : model;
  const acc = usage.get(key) ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, discount: batch ? 0.5 : 1 };
  acc.input += u.input_tokens;
  acc.output += u.output_tokens;
  acc.cacheWrite += u.cache_creation_input_tokens ?? 0;
  acc.cacheRead += u.cache_read_input_tokens ?? 0;
  usage.set(key, acc);
}

function printUsage() {
  let total = 0;
  let known = true;
  console.log('');
  for (const [key, u] of usage) {
    const price = PRICES[key.replace(' (batch)', '')];
    if (!price) known = false;
    const cost = price
      ? ((u.input * price.input + u.output * price.output + u.cacheWrite * price.input * 1.25 + u.cacheRead * price.cacheRead) * u.discount) /
        1_000_000
      : 0;
    total += cost;
    console.log(
      `${key}: вход ${u.input}, выход ${u.output}, запись в кеш ${u.cacheWrite}, чтение из кеша ${u.cacheRead} — ≈ $${price ? cost.toFixed(2) : '? (нет цены)'}`,
    );
  }
  console.log(`Итого ≈ $${total.toFixed(2)}${known ? '' : ' без моделей с неизвестной ценой'}`);
}

// ─── Общие шаги ──────────────────────────────────────────────────────────────

function systemBlock(text: string): Anthropic.TextBlockParam[] {
  // Системный промпт одинаковый для всех вопросов — кешируем
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

function generationMessages(q: Question): Anthropic.MessageParam[] {
  return [{ role: 'user', content: generatorUserPrompt(q, existingFor(q)) }];
}

function reviewMessages(q: Question, wires: readonly WireExercise[]): Anthropic.MessageParam[] {
  return [{ role: 'user', content: reviewerUserPrompt(q, wires) }];
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

function errorText(error: unknown): string {
  if (error instanceof GenerationError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return 'нет доступа к API — задайте ANTHROPIC_API_KEY или выполните `ant auth login`';
  if (error instanceof Anthropic.BadRequestError && /workspace/i.test(error.message)) {
    return 'ключ не привязан к workspace — добавьте ANTHROPIC_WORKSPACE_ID в .env или выпустите ключ внутри workspace';
  }
  if (error instanceof Anthropic.RateLimitError) return 'превышен лимит запросов — уменьшите --concurrency и запустите снова';
  if (error instanceof Anthropic.APIError) return `ошибка API ${error.status}: ${error.message}`;
  return String(error);
}

const isFatal = (error: unknown) =>
  error instanceof Anthropic.AuthenticationError || (error instanceof Anthropic.BadRequestError && /workspace/i.test(error.message));

// ─── Живой режим: запрос за запросом ─────────────────────────────────────────

/** Один запрос со structured outputs. Стрим — потому что с thinking ответ бывает длинным. */
async function ask<T>(model: string, systemPrompt: string, messages: Anthropic.Beta.BetaMessageParam[], schema: z.ZodType<T>) {
  // Если модель откажет из-за ложного срабатывания классификатора, запрос продолжит резервная модель.
  // У Haiku серверного fallback нет.
  const fallback = model.startsWith('claude-haiku')
    ? {}
    : { betas: ['server-side-fallback-2026-07-01'] as Anthropic.Beta.AnthropicBeta[], fallbacks: 'default' as const };
  const stream = client.beta.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    ...fallback,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT, format: betaZodOutputFormat(schema) },
    system: systemBlock(systemPrompt),
    messages,
  });
  const message = await stream.finalMessage();
  // Считаем по модели, которая реально ответила: при fallback это может быть не запрошенная
  track(message.model in PRICES ? message.model : model, message.usage, false);

  if (message.stop_reason === 'refusal') throw new GenerationError(`отказ модели: ${message.stop_details?.category ?? 'без категории'}`);
  if (message.stop_reason === 'max_tokens') throw new GenerationError('ответ обрезан по max_tokens');
  if (!message.parsed_output) throw new GenerationError('ответ не соответствует схеме');
  return { parsed: message.parsed_output, content: message.content };
}

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
  const queue = [...list];
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: Number(args.concurrency) }, async () => {
      for (let q = queue.shift(); q; q = queue.shift()) {
        try {
          console.log(`✓ ${q.slug}: ${await generateLive(q)}`);
        } catch (error) {
          failed.push(q.slug);
          console.error(`✗ ${q.slug}: ${errorText(error)}`);
          // Без доступа к API продолжать бессмысленно
          if (isFatal(error)) queue.length = 0;
        }
      }
    }),
  );
  return failed;
}

// ─── Пакетный режим: Batch API ───────────────────────────────────────────────
// Вдвое дешевле, но ответ приходит в течение суток. Серверный fallback в пакетах не поддерживается.

interface BatchState {
  slugs: string[];
  generation?: string;
  review?: string;
}

function saveState(state: BatchState) {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(BATCH_STATE, JSON.stringify(state, null, 2));
}

function batchRequest<T>(customId: string, model: string, systemPrompt: string, messages: Anthropic.MessageParam[], schema: z.ZodType<T>) {
  return {
    custom_id: customId,
    params: {
      model,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' as const },
      output_config: { effort: EFFORT, format: zodOutputFormat(schema) },
      system: systemBlock(systemPrompt),
      messages,
    },
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Ждёт завершения пакета и разбирает ответы: slug → результат по схеме или текст ошибки. */
async function collect<T>(batchId: string, model: string, schema: z.ZodType<T>, label: string): Promise<Map<string, T | Error>> {
  for (let started = Date.now(); ; ) {
    const batch = await client.messages.batches.retrieve(batchId);
    const c = batch.request_counts;
    const minutes = Math.round((Date.now() - started) / 60_000);
    console.log(`  ${label} ${batchId}: готово ${c.succeeded + c.errored + c.canceled + c.expired} из ${c.processing + c.succeeded + c.errored + c.canceled + c.expired} (${minutes} мин)`);
    if (batch.processing_status === 'ended') break;
    await sleep(60_000);
  }

  const results = new Map<string, T | Error>();
  for await (const item of await client.messages.batches.results(batchId)) {
    if (item.result.type !== 'succeeded') {
      const reason = item.result.type === 'errored' ? item.result.error.error.message : item.result.type;
      results.set(item.custom_id, new Error(reason));
      continue;
    }
    const message = item.result.message;
    track(model, message.usage, true);
    if (message.stop_reason === 'refusal') {
      results.set(item.custom_id, new Error('отказ модели'));
      continue;
    }
    if (message.stop_reason === 'max_tokens') {
      results.set(item.custom_id, new Error('ответ обрезан по max_tokens'));
      continue;
    }
    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    try {
      const parsed = schema.safeParse(JSON.parse(text));
      results.set(item.custom_id, parsed.success ? parsed.data : new Error('ответ не соответствует схеме'));
    } catch {
      results.set(item.custom_id, new Error('ответ — не JSON'));
    }
  }
  return results;
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
