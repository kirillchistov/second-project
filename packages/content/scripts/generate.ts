/**
 * Генерация черновиков упражнений по вопросам банка с помощью Claude.
 *
 *   npm run generate -w @rr/content -- --only keys,rules-of-hooks
 *   npm run generate -w @rr/content -- --topic hooks --limit 5
 *   npm run generate -w @rr/content -- --dry-run --only keys     # показать промпты, без запросов
 *
 * Для каждого вопроса два прохода: генератор пишет упражнения (structured outputs → проверка схемой,
 * при ошибках одна попытка исправить), затем ревьюер проверяет правильность ответов и правит или отбрасывает.
 * Результат — exercises/drafts/<slug>.yaml с замечаниями ревьюера в комментариях. В банк упражнения попадают
 * только после вычитки человеком: npm run approve -w @rr/content.
 *
 * Ключ: ANTHROPIC_API_KEY в .env в корне репозитория (см. .env.example), в окружении или профиль `ant auth login`.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { z } from 'zod';
import type { Exercise } from '../src/exercises.ts';
import { CONTENT_ROOT, DRAFTS_DIR, loadDrafts, loadExercises, loadQuestions } from '../src/node.ts';
import type { Question } from '../src/types.ts';
import {
  applyReviews,
  generationOutput,
  generatorSystemPrompt,
  generatorUserPrompt,
  renderDraft,
  REVIEWER_SYSTEM_PROMPT,
  reviewerUserPrompt,
  reviewOutput,
  uniqueIds,
  validateWire,
  type WireExercise,
} from './generation.ts';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    topic: { type: 'string' },
    limit: { type: 'string' },
    concurrency: { type: 'string', default: '3' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    force: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
  },
});

const MODEL = args.model!;
// Цены claude-opus-5-5, $ за 1M токенов — для оценки стоимости прогона
const PRICE = { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 };

const questions = loadQuestions();
const approved = loadExercises();
const drafts = loadDrafts();

let selected = questions.filter((q) => {
  if (args.only) return args.only.split(',').map((s) => s.trim()).includes(q.slug);
  if (args.topic) return q.topic === args.topic;
  return true;
});
// Без --force не трогаем вопросы, по которым уже есть черновик
if (!args.force) selected = selected.filter((q) => !existsSync(join(DRAFTS_DIR, `${q.slug}.yaml`)));
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

if (selected.length === 0) {
  console.log('Нечего генерировать: по выбранным вопросам уже есть черновики (перегенерировать — --force).');
  process.exit(0);
}

const client = new Anthropic();
const usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

class GenerationError extends Error {}

/** Один запрос со structured outputs. Стрим — потому что с thinking ответ бывает длинным. */
async function ask<T>(systemPrompt: string, messages: Anthropic.Beta.BetaMessageParam[], schema: z.ZodType<T>) {
  const stream = client.beta.messages.stream({
    model: MODEL,
    max_tokens: 64000,
    // Если модель откажет из-за ложного срабатывания классификатора, запрос продолжит резервная модель
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high', format: betaZodOutputFormat(schema) },
    // Системный промпт одинаковый для всех вопросов — кешируем
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages,
  });
  const message = await stream.finalMessage();

  usage.input += message.usage.input_tokens;
  usage.output += message.usage.output_tokens;
  usage.cacheWrite += message.usage.cache_creation_input_tokens ?? 0;
  usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;

  if (message.stop_reason === 'refusal') throw new GenerationError(`отказ модели: ${message.stop_details?.category ?? 'без категории'}`);
  if (message.stop_reason === 'max_tokens') throw new GenerationError('ответ обрезан по max_tokens');
  if (!message.parsed_output) throw new GenerationError('ответ не соответствует схеме');
  return { parsed: message.parsed_output, content: message.content };
}

async function generateFor(q: Question): Promise<string> {
  // 1. Генерация
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: generatorUserPrompt(q, existingFor(q)) }];
  const first = await ask(system, messages, generationOutput);
  let wires: WireExercise[] = first.parsed.exercises;
  let checked = validateWire(wires, q.slug);

  // 2. Одна попытка исправить то, что не прошло схему. Ответ модели передаём целиком — с блоками thinking
  if (checked.invalid.length) {
    messages.push({ role: 'assistant', content: first.content });
    messages.push({
      role: 'user',
      content: `Эти упражнения не прошли проверку схемы:\n${checked.invalid.map((i) => `- ${i.id}: ${i.error}`).join('\n')}\nВерни полный исправленный список упражнений.`,
    });
    wires = (await ask(system, messages, generationOutput)).parsed.exercises;
    checked = validateWire(wires, q.slug);
  }
  const validIds = new Set(checked.valid.map((e) => e.id));
  wires = wires.filter((w) => validIds.has(w.id));
  if (wires.length === 0) throw new GenerationError('ни одно упражнение не прошло схему');

  // 3. Ревью: правильность ответов, однозначность, ограничения экрана
  const review = await ask(REVIEWER_SYSTEM_PROMPT, [{ role: 'user', content: reviewerUserPrompt(q, wires) }], reviewOutput);
  const { kept, notes, dropped } = applyReviews(wires, review.parsed.reviews);
  const final = validateWire(kept, q.slug);
  for (const bad of final.invalid) {
    dropped.push(bad.id);
    console.warn(`  ${q.slug}: исправление ревьюера для ${bad.id} не прошло схему — упражнение отброшено`);
  }

  // 4. Черновик: id уникальны относительно банка и других черновиков
  const taken = new Set([...approved, ...drafts].map((e) => e.id));
  const exercises: Exercise[] = uniqueIds(final.valid, taken);
  mkdirSync(DRAFTS_DIR, { recursive: true });
  const file = join(DRAFTS_DIR, `${q.slug}.yaml`);
  writeFileSync(
    file,
    renderDraft({ question: q, exercises, notes, dropped, model: MODEL, date: new Date().toISOString().slice(0, 10) }),
  );
  for (const e of exercises) taken.add(e.id);
  drafts.push(...exercises);
  return `${exercises.length} упр.${dropped.length ? `, отброшено ${dropped.length}` : ''}`;
}

function errorText(error: unknown): string {
  if (error instanceof GenerationError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return 'нет доступа к API — задайте ANTHROPIC_API_KEY или выполните `ant auth login`';
  if (error instanceof Anthropic.RateLimitError) return 'превышен лимит запросов — уменьшите --concurrency и запустите снова';
  if (error instanceof Anthropic.APIError) return `ошибка API ${error.status}: ${error.message}`;
  return String(error);
}

console.log(`Генерация по ${selected.length} вопросам, модель ${MODEL}, параллельно ${args.concurrency}. Черновики → ${DRAFTS_DIR.replace(CONTENT_ROOT + '/', '')}`);

const queue = [...selected];
const failed: string[] = [];
await Promise.all(
  Array.from({ length: Number(args.concurrency) }, async () => {
    for (let q = queue.shift(); q; q = queue.shift()) {
      try {
        console.log(`✓ ${q.slug}: ${await generateFor(q)}`);
      } catch (error) {
        failed.push(q.slug);
        console.error(`✗ ${q.slug}: ${errorText(error)}`);
        // Без доступа к API продолжать бессмысленно
        if (error instanceof Anthropic.AuthenticationError) queue.length = 0;
      }
    }
  }),
);

const cost =
  (usage.input * PRICE.input + usage.output * PRICE.output + usage.cacheWrite * PRICE.cacheWrite + usage.cacheRead * PRICE.cacheRead) /
  1_000_000;
console.log(
  `\nТокены: вход ${usage.input}, выход ${usage.output}, запись в кеш ${usage.cacheWrite}, чтение из кеша ${usage.cacheRead}. ≈ $${cost.toFixed(2)}`,
);
if (failed.length) {
  console.log(`Не получилось: ${failed.join(', ')} — можно перезапустить с --only.`);
  process.exitCode = 1;
}
