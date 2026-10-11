/**
 * Общая работа с Claude для скриптов контента: клиент, учёт расхода, живые запросы и Batch API.
 * Используют generate.ts (упражнения), rubrics.ts (рубрики оценки) и radar.ts (актуализация).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import type { z } from 'zod';

export const MAX_TOKENS = 64000;
export const EFFORT = 'high' as const;

// $ за 1M токенов — для оценки стоимости прогона. Запись в кеш — 1.25× от входа, Batch API — скидка 50%.
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

// Ключ организации без привязки к workspace требует явный workspace в заголовке
const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
export const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});

export class GenerationError extends Error {}

// ─── Учёт расхода ────────────────────────────────────────────────────────────

type Usage = { input: number; output: number; cacheWrite: number; cacheRead: number; discount: number };
/** Расход по моделям и режимам: пакеты считаются со скидкой */
const usage = new Map<string, Usage>();

export function track(model: string, u: Anthropic.Usage | Anthropic.Beta.BetaUsage, batch: boolean) {
  const key = batch ? `${model} (batch)` : model;
  const acc = usage.get(key) ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0, discount: batch ? 0.5 : 1 };
  acc.input += u.input_tokens;
  acc.output += u.output_tokens;
  acc.cacheWrite += u.cache_creation_input_tokens ?? 0;
  acc.cacheRead += u.cache_read_input_tokens ?? 0;
  usage.set(key, acc);
}

export function printUsage() {
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

export function errorText(error: unknown): string {
  if (error instanceof GenerationError) return error.message;
  if (error instanceof Anthropic.AuthenticationError) return 'нет доступа к API — задайте ANTHROPIC_API_KEY или выполните `ant auth login`';
  if (error instanceof Anthropic.BadRequestError && /workspace/i.test(error.message)) {
    return 'ключ не привязан к workspace — добавьте ANTHROPIC_WORKSPACE_ID в .env или выпустите ключ внутри workspace';
  }
  if (error instanceof Anthropic.RateLimitError) return 'превышен лимит запросов — уменьшите --concurrency и запустите снова';
  if (error instanceof Anthropic.APIError) return `ошибка API ${error.status}: ${error.message}`;
  return String(error);
}

/** Ошибки, после которых продолжать прогон бессмысленно: нет доступа к API. */
export const isFatal = (error: unknown) =>
  error instanceof Anthropic.AuthenticationError || (error instanceof Anthropic.BadRequestError && /workspace/i.test(error.message));

export function systemBlock(text: string): Anthropic.TextBlockParam[] {
  // Системные промпты скриптов одинаковые для всех запросов прогона — кешируем
  return [{ type: 'text', text, cache_control: { type: 'ephemeral' } }];
}

// ─── Живой запрос ────────────────────────────────────────────────────────────

/** Один запрос со structured outputs. Стрим — потому что с thinking ответ бывает длинным. */
export async function ask<T>(model: string, systemPrompt: string, messages: Anthropic.Beta.BetaMessageParam[], schema: z.ZodType<T>) {
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

/** Прогон списка задач с ограничением параллельности. Возвращает id упавших. */
export async function runPool<T>(items: T[], concurrency: number, id: (item: T) => string, work: (item: T) => Promise<string>) {
  const queue = [...items];
  const failed: string[] = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift()) {
        try {
          console.log(`✓ ${id(item)}: ${await work(item)}`);
        } catch (error) {
          failed.push(id(item));
          console.error(`✗ ${id(item)}: ${errorText(error)}`);
          if (isFatal(error)) queue.length = 0;
        }
      }
    }),
  );
  return failed;
}

// ─── Batch API ───────────────────────────────────────────────────────────────
// Вдвое дешевле, но ответ приходит в течение суток. Серверный fallback в пакетах не поддерживается.

export function batchRequest<T>(customId: string, model: string, systemPrompt: string, messages: Anthropic.MessageParam[], schema: z.ZodType<T>) {
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

/** Ждёт завершения пакета и разбирает ответы: custom_id → результат по схеме или ошибка. */
export async function collect<T>(batchId: string, model: string, schema: z.ZodType<T>, label: string): Promise<Map<string, T | Error>> {
  for (let started = Date.now(); ; ) {
    const batch = await client.messages.batches.retrieve(batchId);
    const c = batch.request_counts;
    const done = c.succeeded + c.errored + c.canceled + c.expired;
    console.log(`  ${label} ${batchId}: готово ${done} из ${done + c.processing} (${Math.round((Date.now() - started) / 60_000)} мин)`);
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
