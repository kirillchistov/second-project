/**
 * Changelog Radar: что изменилось в React и соседних библиотеках и какие вопросы и упражнения это задевает.
 *
 *   npm run radar -w @rr/content                        # с даты прошлого запуска (radar/state.json)
 *   npm run radar -w @rr/content -- --since 2026-06-01
 *   npm run radar -w @rr/content -- --no-generate       # только отчёт, без черновиков
 *   npm run radar -w @rr/content -- --batch             # черновики через Batch API
 *   npm run radar -w @rr/content -- --web               # глубокое исследование с веб-поиском (дорого: ~$5–10)
 *
 * 1. Сбор: стабильные релизы с GitHub API и записи блогов из RSS — без модели и бесплатно (GITHUB_TOKEN — по желанию).
 *    С --web вместо этого Claude сам ищет и читает источники: полнее, но каждая страница — тысячи входных токенов.
 * 2. Сопоставление: сводка + индекс банка → затронутые вопросы, устаревшие упражнения, правки текста, новые темы.
 * 3. Отчёт radar/<дата>.md (его читает человек) и черновики упражнений по затронутым вопросам через generate.ts.
 * Вопросы в Markdown радар не правит: предлагает правку в отчёте, человек вносит её и обновляет @verified/@updated.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CONTENT_ROOT, loadExercises, loadQuestions } from '../src/node.ts';
import { ask, client, errorText, GenerationError, printUsage, PRICES, track } from './claude.ts';
import {
  feedItemsSince,
  htmlToText,
  LIBRARIES,
  mappingOutput,
  MAPPING_SYSTEM,
  mappingPrompt,
  releasesDigest,
  renderRadarReport,
  RESEARCH_SYSTEM,
  researchPrompt,
  stableReleasesSince,
  trimNotes,
  type GithubRelease,
  type Release,
} from './radar-lib.ts';

const { values: args } = parseArgs({
  options: {
    since: { type: 'string' },
    model: { type: 'string', default: 'claude-opus-5-5' },
    'no-generate': { type: 'boolean', default: false },
    batch: { type: 'boolean', default: false },
    web: { type: 'boolean', default: false },
  },
});

const RADAR_DIR = join(CONTENT_ROOT, 'radar');
/** Статей блога на источник и символов на статью: этого хватает на суть релиза */
const ARTICLES_PER_FEED = 4;
const ARTICLE_CHARS = 14000;
const STATE_FILE = join(RADAR_DIR, 'state.json');
const MODEL = args.model!;
const today = new Date().toISOString().slice(0, 10);

const state: { lastRun?: string } = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
// Первый запуск — за последние 90 дней
const since = args.since ?? state.lastRun ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);

const questions = loadQuestions();
const exercises = loadExercises();

/** Бесплатный сбор: релизы с GitHub и записи блогов. Недоступный источник не роняет радар — попадает в отчёт. */
async function collectReleases(): Promise<string> {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'react-refresher-radar' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const found: Release[] = [];
  const failed: string[] = [];
  for (const lib of LIBRARIES) {
    if (lib.repo) {
      try {
        const res = await fetch(`https://api.github.com/repos/${lib.repo}/releases?per_page=100`, { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        found.push(...stableReleasesSince(lib.name, (await res.json()) as GithubRelease[], since, lib.include));
      } catch (error) {
        failed.push(`${lib.repo} (${error instanceof Error ? error.message : error})`);
      }
    }
    if (lib.feed) {
      try {
        const res = await fetch(lib.feed, { headers: { 'user-agent': 'react-refresher-radar' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // В RSS только аннотация — сами статьи скачиваем и превращаем в текст (без модели, бесплатно)
        const items = feedItemsSince(lib.name, await res.text(), since).slice(0, ARTICLES_PER_FEED);
        for (const item of items) {
          try {
            const page = await fetch(item.url, { headers: { 'user-agent': 'react-refresher-radar' } });
            if (page.ok) item.notes = trimNotes(htmlToText(await page.text()), ARTICLE_CHARS);
          } catch {
            // остаётся аннотация из RSS
          }
        }
        found.push(...items);
      } catch (error) {
        failed.push(`${lib.feed} (${error instanceof Error ? error.message : error})`);
      }
    }
  }
  console.log(`  собрано записей: ${found.length}${failed.length ? `, недоступны: ${failed.join(', ')}` : ''}`);
  const note = failed.length ? `\n\nНе удалось получить: ${failed.join(', ')}.` : '';
  return releasesDigest(found.sort((a, b) => a.library.localeCompare(b.library) || a.date.localeCompare(b.date))) + note;
}

/** Исследование с веб-поиском. Серверный цикл инструментов может прерваться (pause_turn) — тогда продолжаем. */
async function research(): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: researchPrompt(LIBRARIES, since, today) }];
  for (let turn = 0; turn < 6; turn++) {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
      system: RESEARCH_SYSTEM,
      // Лимиты держат цену: каждая прочитанная страница — тысячи входных токенов на каждом шаге цикла
      tools: [
        { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
        { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8, max_content_tokens: 8000 },
      ],
      messages,
    });
    const message = await stream.finalMessage();
    track(message.model in PRICES ? message.model : MODEL, message.usage, false);
    if (message.stop_reason === 'pause_turn') {
      // Сервер продолжит с того же места: возвращаем ему ответ целиком, без новой реплики пользователя
      messages.push({ role: 'assistant', content: message.content });
      continue;
    }
    if (message.stop_reason === 'refusal') throw new GenerationError('модель отказалась от исследования');
    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    if (!text) throw new GenerationError('исследование вернулось без текста');
    return text;
  }
  throw new GenerationError('исследование не закончилось за 6 продолжений');
}

try {
  console.log(`Радар: изменения с ${since} по ${today}, модель ${MODEL}`);
  console.log(args.web ? '1/3 Исследование релизов с веб-поиском…' : '1/3 Сбор релизов с GitHub и из блогов…');
  const findings = args.web ? await research() : await collectReleases();

  console.log('2/3 Сопоставление с банком вопросов и упражнений…');
  const { parsed: mapping } = await ask(MODEL, MAPPING_SYSTEM, [{ role: 'user', content: mappingPrompt(findings, questions, exercises) }], mappingOutput);

  // Только существующие вопросы и упражнения: модель могла ошибиться в slug или id
  const slugs = new Set(questions.map((q) => q.slug));
  const ids = new Set(exercises.map((e) => e.id));
  const affected = mapping.affected
    .filter((a) => slugs.has(a.slug))
    .map((a) => ({ ...a, outdatedExercises: a.outdatedExercises.filter((id) => ids.has(id)) }));
  const result = { ...mapping, affected, since, until: today };

  mkdirSync(RADAR_DIR, { recursive: true });
  // Повторный запуск в тот же день не должен затирать прошлый отчёт
  const base = `${today}${args.web ? '-web' : ''}`;
  let name = base;
  for (let n = 2; existsSync(join(RADAR_DIR, `${name}.md`)); n++) name = `${base}-${n}`;
  writeFileSync(join(RADAR_DIR, `${name}.md`), renderRadarReport(result, findings, questions));
  writeFileSync(join(RADAR_DIR, `${name}.json`), JSON.stringify(result, null, 2));
  writeFileSync(STATE_FILE, JSON.stringify({ lastRun: today }, null, 2));
  console.log(`Отчёт: radar/${name}.md — изменений ${result.changes.length}, затронуто вопросов ${affected.length}`);

  if (affected.length > 0 && !args['no-generate']) {
    console.log('3/3 Черновики упражнений по затронутым вопросам…');
    const contextFile = join(RADAR_DIR, `${name}.context.json`);
    writeFileSync(
      contextFile,
      JSON.stringify(Object.fromEntries(affected.map((a) => [a.slug, [a.change, a.questionEdit && `Что поправить в вопросе: ${a.questionEdit}`].filter(Boolean).join('\n')]))),
    );
    const run = spawnSync(
      process.execPath,
      ['--env-file-if-exists=../../.env', 'scripts/generate.ts', '--context', contextFile, ...(args.batch ? ['--batch'] : [])],
      { cwd: CONTENT_ROOT, stdio: 'inherit' },
    );
    if (run.status !== 0) process.exitCode = 1;
  } else {
    console.log('3/3 Черновики не нужны или отключены.');
  }
} catch (error) {
  console.error(`✗ ${errorText(error)}`);
  process.exitCode = 1;
}
printUsage();
