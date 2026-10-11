/**
 * Чистые части генератора упражнений: формат ответа модели, промпты, проверка и оформление черновика.
 * Сетевая часть — в generate.ts; здесь только то, что можно проверить тестами без API.
 */
import { stringify } from 'yaml';
import { z } from 'zod';
import { exerciseSchema, type Exercise } from '../src/exercises.ts';
import type { Question } from '../src/types.ts';

// ─── Формат ответа модели ────────────────────────────────────────────────────
// Отдельная «проводная» схема: все поля обязательны, без регулярок и значений по умолчанию —
// так её надёжно принимает structured outputs. После ответа всё проверяется настоящей exerciseSchema.

const option = z.object({ label: z.string(), why: z.string() });
const language = z.enum(['tsx', 'ts', 'jsx', 'js']);
const common = {
  id: z.string(),
  skill: z.string(),
  difficulty: z.number().int(),
  prompt: z.string(),
  explanation: z.string(),
};

export const wireExercise = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('predict-output'), language, code: z.string(), options: z.array(z.string()), answer: z.number().int() }),
  z.object({
    ...common,
    type: z.literal('find-bug'),
    language,
    code: z.string(),
    bugLines: z.array(z.number().int()),
    causes: z.array(z.string()),
    answer: z.number().int(),
  }),
  z.object({ ...common, type: z.literal('parsons'), language, lines: z.array(z.string()), distractors: z.array(z.string()) }),
  z.object({ ...common, type: z.literal('fill-tokens'), language, code: z.string(), tokens: z.array(z.string()), decoys: z.array(z.string()) }),
  z.object({ ...common, type: z.literal('order'), kind: z.enum(['timeline', 'recipe']), steps: z.array(z.string()) }),
  z.object({ ...common, type: z.literal('choose-tool'), options: z.array(option), answer: z.number().int() }),
  z.object({ ...common, type: z.literal('quiz'), options: z.array(option), answer: z.number().int() }),
]);
export type WireExercise = z.infer<typeof wireExercise>;

/**
 * То, что реально уходит в structured outputs: один плоский объект со всеми полями всех типов.
 * Объединение семи типов даёт слишком большую грамматику («compiled grammar is too large»),
 * поэтому модель заполняет только поля своего типа, остальные оставляет пустыми, а fromFlat
 * собирает из этого упражнение нужного типа.
 */
export const flatExercise = z.object({
  type: z.enum(['quiz', 'predict-output', 'find-bug', 'parsons', 'fill-tokens', 'order', 'choose-tool']),
  id: z.string(),
  skill: z.string(),
  difficulty: z.number().int(),
  prompt: z.string(),
  explanation: z.string(),
  /** Для типов с кодом; иначе "tsx" */
  language: z.enum(['tsx', 'ts', 'jsx', 'js']),
  /** predict-output, find-bug, fill-tokens; иначе "" */
  code: z.string(),
  /** quiz, choose-tool, predict-output (why для predict-output можно оставить пустым); иначе [] */
  options: z.array(option),
  /** Индекс верного варианта для quiz, choose-tool, predict-output; верной причины для find-bug; иначе 0 */
  answer: z.number().int(),
  bugLines: z.array(z.number().int()),
  causes: z.array(z.string()),
  /** parsons: строки решения по порядку */
  lines: z.array(z.string()),
  distractors: z.array(z.string()),
  tokens: z.array(z.string()),
  decoys: z.array(z.string()),
  /** order: timeline или recipe; иначе "none" */
  kind: z.enum(['timeline', 'recipe', 'none']),
  steps: z.array(z.string()),
});
export type FlatExercise = z.infer<typeof flatExercise>;

export function fromFlat(f: FlatExercise): WireExercise {
  const common = { id: f.id, skill: f.skill, difficulty: f.difficulty, prompt: f.prompt, explanation: f.explanation };
  switch (f.type) {
    case 'quiz':
    case 'choose-tool':
      return { ...common, type: f.type, options: f.options, answer: f.answer };
    case 'predict-output':
      return { ...common, type: f.type, language: f.language, code: f.code, options: f.options.map((o) => o.label), answer: f.answer };
    case 'find-bug':
      return { ...common, type: f.type, language: f.language, code: f.code, bugLines: f.bugLines, causes: f.causes, answer: f.answer };
    case 'parsons':
      return { ...common, type: f.type, language: f.language, lines: f.lines, distractors: f.distractors };
    case 'fill-tokens':
      return { ...common, type: f.type, language: f.language, code: f.code, tokens: f.tokens, decoys: f.decoys };
    case 'order':
      // kind=none — ошибка модели; timeline как безопасный вариант, ревьюер увидит формулировку
      return { ...common, type: f.type, kind: f.kind === 'recipe' ? 'recipe' : 'timeline', steps: f.steps };
  }
}

export const generationOutput = z.object({ exercises: z.array(flatExercise) });

export const reviewOutput = z.object({
  reviews: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(['ok', 'fix', 'drop']),
      /** Что не так — уходит комментарием в черновик для человека */
      issues: z.array(z.string()),
      /** Исправленное упражнение целиком, только при verdict = fix */
      fixed: flatExercise.nullable(),
    }),
  ),
});
export type Review = Omit<z.infer<typeof reviewOutput>['reviews'][number], 'fixed'> & { fixed: WireExercise | null };

/** Вердикты ревьюера с исправлениями, переведёнными из плоского формата. */
export function reviewsFromOutput(output: z.infer<typeof reviewOutput>): Review[] {
  return output.reviews.map((r) => ({ ...r, fixed: r.fixed ? fromFlat(r.fixed) : null }));
}

// ─── Промпты ─────────────────────────────────────────────────────────────────

/** Стабильная часть промпта генератора — кешируется между вопросами, поэтому без дат и случайных данных. */
export function generatorSystemPrompt(examples: readonly Exercise[]): string {
  return `Ты — методист и senior frontend-разработчик. Ты делаешь упражнения для мобильного тренажёра,
который помогает middle-разработчикам не забывать React и смежные технологии.

Цель упражнений — закрепить в памяти алгоритмы решения практических задач и связку
«класс задачи → подходящая техника». Не проверяй мелкие факты ради фактов: каждое упражнение
должно тренировать то, что пригодится в реальной работе или на собеседовании.

Целевые версии: React 19.2 (Actions, use, useOptimistic, React Compiler, Activity), TypeScript 5+,
актуальные Next.js, TanStack Query, Vitest, Testing Library. Не выдумывай API. Если не уверен,
как именно поведёт себя код, не делай по нему predict-output.

## Типы упражнений

- quiz — карточка с вариантами для вопроса из банка: альтернатива «объясни своими словами».
  3–4 варианта, ровно один верный. Неверные — правдоподобные формулировки типичных заблуждений,
  а не очевидная чепуха. У каждого варианта why: почему он верен или неверен.
- predict-output — код и варианты того, что окажется в консоли или на экране. Только для
  детерминированного поведения. Если важен StrictMode — явно укажи в prompt, что его нет.
- find-bug — код с одной ошибкой. bugLines — номера строк с ошибкой, считая с 1 (можно 1–2 строки,
  если ошибка охватывает обе). causes — 3–4 причины, ровно одна верная (answer — её индекс).
- fill-tokens — код, где ключевые токены заменены на ___ (три подчёркивания). tokens — правильные токены
  по порядку пропусков, decoys — 2–4 правдоподобных лишних токена (не совпадают с правильными).
  Пропусков 2–4, и каждый однозначен.
- parsons — правильные строки кода по порядку (отступы — пробелами, они часть ответа)
  и 1–3 строки-ловушки, которые выглядят уместно, но ломают решение.
- order — шаги по порядку: kind=timeline для порядка событий (рендер, эффекты, гидрация),
  kind=recipe для алгоритма решения практической задачи. 4–6 шагов.
- choose-tool — сценарий из реальной работы и 3–4 техники или инструмента. Ровно один лучший
  для этих условий; why объясняет, когда подошёл бы каждый из остальных. Это главный тип
  для связки «класс задачи → технология».

## Ограничения мобильного экрана

- Код: не больше 14 строк, строки по возможности до 48 символов, отступ 2 пробела.
- Варианты ответа: до 140 символов. why: до 220 символов. explanation: до 400 символов.
- Текст на русском, код и идентификаторы — на английском. Без Markdown-заголовков; \`код\` и **акцент** можно.

## Поля

- id — kebab-case, уникальный, начинается с темы задания (например, effect-cleanup-order).
- skill — kebab-case атом навыка: что именно тренирует упражнение. Разные упражнения про одно
  и то же умение получают один skill — по нему считается интервальное повторение.
- difficulty — 1 (база), 2 (middle), 3 (тонкости и senior-нюансы).
- answer — индекс верного варианта с 0. Порядок вариантов не важен: приложение их перемешивает.

## Формат ответа

Каждое упражнение — объект со всеми полями сразу. Заполняй только поля своего типа,
остальные оставь пустыми: строки "", массивы [], answer 0, kind "none", language "tsx".
У predict-output варианты — options с пустым why.
- explanation — разбор после ответа: почему верно и какое правило вынести.

## Примеры хороших упражнений

${stringify(examples)}`;
}

export function questionMarkdown(q: Question): string {
  const list = (title: string, items: string[]) => (items.length ? `\n### ${title}\n${items.map((i) => `- ${i}`).join('\n')}\n` : '');
  return `# ${q.title}
slug: ${q.slug} · уровень: ${q.level} · тема: ${q.topic}

> ${q.short}

${q.body}
${list('Подводные камни', q.pitfalls)}${list('Что спросят дальше', q.followUps)}`;
}

export function generatorUserPrompt(q: Question, existing: readonly Exercise[]): string {
  const hasQuiz = existing.some((e) => e.type === 'quiz');
  const existingList = existing.length
    ? `\nУже есть упражнения по этому вопросу — не повторяй их идеи:\n${existing.map((e) => `- ${e.type} ${e.id}: ${e.prompt}`).join('\n')}\n`
    : '';
  return `Сделай упражнения по вопросу из банка.

${questionMarkdown(q)}
${existingList}
Нужно:
${hasQuiz ? '' : '- ровно один quiz по главной мысли вопроса;\n'}- 2–3 практических упражнения разных типов, которые лучше всего подходят к содержанию:
  для кода — find-bug, fill-tokens, predict-output, parsons; для выбора подхода — choose-tool;
  для процессов и алгоритмов — order. Если вопрос концептуальный и практику не придумать
  без натяжек, лучше меньше упражнений, но хороших.`;
}

export const REVIEWER_SYSTEM_PROMPT = `Ты — строгий ревьюер учебного контента по React и фронтенду, senior-разработчик.
Тебе дают вопрос из банка и упражнения к нему. Проверь каждое упражнение:

1. Правильный ответ действительно верен для React 19.2 / TypeScript 5+ и он единственный верный.
2. Неверные варианты однозначно неверны, но правдоподобны (типичные заблуждения).
3. Код корректен по смыслу; в find-bug номера bugLines указывают на строки с ошибкой (нумерация с 1, см. пронумерованный код).
4. В fill-tokens каждый пропуск однозначен; в parsons ловушки действительно ломают решение; в order порядок бесспорен.
5. Ограничения экрана: код до 14 строк, варианты до 140 символов, explanation до 400.
6. Русский язык грамотный, формулировки ясные, нет подсказок в тексте вопроса.

verdict: ok — можно публиковать; fix — есть исправимые проблемы, верни исправленное упражнение целиком в fixed
(тот же id и type); drop — упражнение спорное или бесполезное, исправлять не стоит.
issues — коротко, что не так (пусто, если ok). Будь требователен: неверный ответ в тренажёре вреднее, чем отсутствие упражнения.`;

function numbered(code: string): string {
  return code
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(2)} | ${line}`)
    .join('\n');
}

export function reviewerUserPrompt(q: Question, exercises: readonly WireExercise[]): string {
  const withNumbers = exercises
    .flatMap((e) => (e.type === 'find-bug' ? [`Код ${e.id} с номерами строк:\n${numbered(e.code)}`] : []))
    .join('\n\n');
  return `${questionMarkdown(q)}

## Упражнения на проверку

${JSON.stringify(exercises, null, 2)}
${withNumbers ? `\n${withNumbers}\n` : ''}`;
}

// ─── Проверка и оформление ───────────────────────────────────────────────────

/** Проводной формат → упражнение схемы контента; question проставляет скрипт, а не модель. */
export function toExercise(wire: WireExercise, questionSlug: string): unknown {
  return { ...wire, question: questionSlug, difficulty: Math.min(3, Math.max(1, wire.difficulty)) };
}

export interface Validated {
  valid: Exercise[];
  invalid: { id: string; error: string }[];
}

export function validateWire(wires: readonly WireExercise[], questionSlug: string): Validated {
  const valid: Exercise[] = [];
  const invalid: Validated['invalid'] = [];
  for (const wire of wires) {
    const result = exerciseSchema.safeParse(toExercise(wire, questionSlug));
    if (result.success) valid.push(result.data);
    else invalid.push({ id: wire.id, error: z.prettifyError(result.error) });
  }
  return { valid, invalid };
}

/** Применяет вердикты ревьюера: ok — как есть, fix — исправленная версия, drop — убрать. */
export function applyReviews(
  exercises: readonly WireExercise[],
  reviews: readonly Review[],
): { kept: WireExercise[]; notes: Map<string, string[]>; dropped: string[] } {
  const byId = new Map(reviews.map((r) => [r.id, r]));
  const kept: WireExercise[] = [];
  const notes = new Map<string, string[]>();
  const dropped: string[] = [];
  for (const ex of exercises) {
    const review = byId.get(ex.id);
    if (!review) {
      // Ревьюер пропустил упражнение — оставляем, но помечаем для человека
      kept.push(ex);
      notes.set(ex.id, ['ревьюер не проверил это упражнение']);
      continue;
    }
    if (review.verdict === 'drop') {
      dropped.push(ex.id);
      continue;
    }
    const fixed = review.verdict === 'fix' && review.fixed && review.fixed.type === ex.type ? { ...review.fixed, id: ex.id } : ex;
    kept.push(fixed);
    if (review.issues.length) notes.set(ex.id, [review.verdict === 'fix' ? 'исправлено ревьюером:' : 'замечания:', ...review.issues]);
  }
  return { kept, notes, dropped };
}

/** Делает id уникальными относительно уже занятых, добавляя суффикс -2, -3… */
export function uniqueIds<T extends { id: string }>(items: readonly T[], taken: ReadonlySet<string>): T[] {
  const used = new Set(taken);
  return items.map((item) => {
    let id = item.id;
    for (let n = 2; used.has(id); n++) id = `${item.id}-${n}`;
    used.add(id);
    return id === item.id ? item : { ...item, id };
  });
}

/** Текст файла черновика: шапка с источником и замечания ревьюера комментариями — их читает человек. */
export function renderDraft(opts: {
  question: Question;
  exercises: readonly Exercise[];
  notes: ReadonlyMap<string, string[]>;
  dropped: readonly string[];
  model: string;
  date: string;
}): string {
  const { question, exercises, notes, dropped, model, date } = opts;
  const header = [
    `# Черновик упражнений: «${question.title}» (${question.slug})`,
    `# Сгенерировано ${model}, ${date}. Проверено ревьюером-моделью, нужна вычитка человеком.`,
    `# Принять: npm run approve -w @rr/content -- --only ${question.slug}`,
    ...(dropped.length ? [`# Отброшено ревьюером: ${dropped.join(', ')}`] : []),
  ];
  const body = exercises
    .map((ex) => {
      const comment = (notes.get(ex.id) ?? []).map((n) => `# ${n}`).join('\n');
      const yaml = stringify([ex], { lineWidth: 0 });
      return comment ? `${comment}\n${yaml}` : yaml;
    })
    .join('\n');
  return `${header.join('\n')}\n\n${body}`;
}
