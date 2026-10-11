/**
 * Рубрики для режима «Объясни голосом»: по эталонному ответу каждого вопроса — проверяемые пункты с весами
 * и типичные заблуждения. Пишутся в rubrics/<тема>.yaml; это контент, его можно вычитывать и править руками.
 *
 *   npm run rubrics -w @rr/content -- --only keys,use-state     # живые запросы
 *   npm run rubrics -w @rr/content -- --batch                   # все вопросы без рубрики, Batch API
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { stringify } from 'yaml';
import { z } from 'zod';
import { rubricSchema, type Rubric } from '../src/rubrics.ts';
import { loadQuestions, loadRubrics, RUBRICS_DIR } from '../src/node.ts';
import type { Question } from '../src/types.ts';
import { ask, batchRequest, client, collect, printUsage, runPool } from './claude.ts';
import { questionMarkdown } from './generation.ts';

const { values: args } = parseArgs({
  options: {
    only: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    batch: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '4' },
  },
});

// Проводная схема для structured outputs: без регулярок и значений по умолчанию
const wire = z.object({
  points: z.array(z.object({ id: z.string(), text: z.string(), weight: z.number().int() })),
  misconceptions: z.array(z.string()),
});

const SYSTEM = `Ты — senior frontend-разработчик и интервьюер. По вопросу из банка и эталонному ответу составь рубрику
для оценки устного ответа кандидата уровня middle за 60–90 секунд.

- 3–6 пунктов. Каждый — одна проверяемая мысль, которую можно однозначно найти или не найти в ответе.
  Формулируй как утверждение («cleanup выполняется перед следующим запуском эффекта и при размонтировании»),
  а не как тему («cleanup»).
- weight: 3 — суть, без неё ответ неверен (1–2 таких пункта); 2 — важная деталь или пример; 1 — плюс, отличающий сильный ответ.
- id — kebab-case на английском, коротко.
- misconceptions — 2–4 типичных заблуждения по теме: если кандидат их произнёс, это фактическая ошибка.
- Целевые версии: React 19.2, TypeScript 5+. Только то, что есть в эталоне или общепринято; не выдумывай.
- Текст на русском, идентификаторы кода — на английском в обратных кавычках.`;

const questions = loadQuestions();
const existing = loadRubrics();
const has = new Set(existing.map((r) => r.question));

let selected = args.only ? questions.filter((q) => args.only!.split(',').includes(q.slug)) : questions;
if (!args.force) selected = selected.filter((q) => !has.has(q.slug));

function toRubric(q: Question, w: z.infer<typeof wire>): Rubric {
  return rubricSchema.parse({
    question: q.slug,
    points: w.points.map((p) => ({ ...p, weight: Math.min(3, Math.max(1, p.weight)) })),
    misconceptions: w.misconceptions,
  });
}

const prompt = (q: Question) => [{ role: 'user' as const, content: questionMarkdown(q) }];
const made = new Map<string, Rubric>();

if (selected.length === 0) {
  console.log('Нечего делать: у всех выбранных вопросов уже есть рубрики (перегенерировать — --force).');
  process.exit(0);
}
console.log(`Рубрики для ${selected.length} вопросов, модель ${args.model}${args.batch ? ', Batch API' : ''}`);

let failed: string[] = [];
if (args.batch) {
  const batch = await client.messages.batches.create({
    requests: selected.map((q) => batchRequest(q.slug, args.model!, SYSTEM, prompt(q), wire)),
  });
  console.log(`Пакет отправлен: ${batch.id}`);
  const results = await collect(batch.id, args.model!, wire, 'рубрики');
  for (const q of selected) {
    const r = results.get(q.slug);
    try {
      if (!r || r instanceof Error) throw r ?? new Error('нет ответа');
      made.set(q.slug, toRubric(q, r));
    } catch (error) {
      failed.push(q.slug);
      console.error(`✗ ${q.slug}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} else {
  failed = await runPool(selected, Number(args.concurrency), (q) => q.slug, async (q) => {
    const { parsed } = await ask(args.model!, SYSTEM, prompt(q), wire);
    const rubric = toRubric(q, parsed);
    made.set(q.slug, rubric);
    return `${rubric.points.length} пунктов`;
  });
}

// Запись: по файлу на тему, в порядке вопросов банка; новые рубрики заменяют старые с тем же вопросом
const all = new Map(existing.map((r) => [r.question, r]));
for (const [slug, r] of made) all.set(slug, r);
mkdirSync(RUBRICS_DIR, { recursive: true });
const byTopic = new Map<string, Rubric[]>();
for (const q of questions) {
  const r = all.get(q.slug);
  if (r) byTopic.set(q.topic, [...(byTopic.get(q.topic) ?? []), r]);
}
for (const [topic, list] of byTopic) writeFileSync(join(RUBRICS_DIR, `${topic}.yaml`), stringify(list, { lineWidth: 0 }));

console.log(`Готово: ${made.size} рубрик → rubrics/`);
printUsage();
if (failed.length) {
  console.log(`Не получилось: ${failed.join(', ')}`);
  process.exitCode = 1;
}
