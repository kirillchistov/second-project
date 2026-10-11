/**
 * Перенос вычитанных черновиков в банк упражнений и удаление устаревших.
 *
 *   npm run approve -w @rr/content -- --only keys,rules-of-hooks
 *   npm run approve -w @rr/content -- --all
 *   npm run approve -w @rr/content -- --retire old-id-1,old-id-2   # убрать устаревшие (их называет радар)
 *
 * Перед переносом черновик ещё раз проверяется: схема, существующий вопрос, уникальные id.
 * Упражнения дописываются в exercises/<тема вопроса>.yaml, файл черновика удаляется.
 * Править упражнения удобнее прямо в черновике, до approve: комментарии ревьюера там же.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { stringify } from 'yaml';
import { CONTENT_ROOT, DRAFTS_DIR, loadDraftFiles, loadExercises, loadQuestions } from '../src/node.ts';
import { removeExercises } from './bank.ts';

const { values: args } = parseArgs({
  options: { only: { type: 'string' }, all: { type: 'boolean', default: false }, retire: { type: 'string' } },
});
if (!args.only && !args.all && !args.retire) {
  console.error('Укажите --only slug1,slug2, --all или --retire id1,id2');
  process.exit(1);
}

let failed = false;

if (args.retire) {
  const ids = new Set(args.retire.split(',').map((s) => s.trim()));
  const dir = join(CONTENT_ROOT, 'exercises');
  const found: string[] = [];
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.yaml'))) {
    const file = join(dir, name);
    const { text, removed } = removeExercises(readFileSync(file, 'utf8'), ids);
    if (removed.length) {
      writeFileSync(file, text);
      found.push(...removed);
      console.log(`✓ exercises/${name}: убрано ${removed.join(', ')}`);
    }
  }
  const missing = [...ids].filter((id) => !found.includes(id));
  if (missing.length) {
    console.error(`✗ не найдены в банке: ${missing.join(', ')}`);
    failed = true;
  }
}
if (!args.only && !args.all) process.exit(failed ? 1 : 0);

const questions = new Map(loadQuestions().map((q) => [q.slug, q]));
const taken = new Set(loadExercises().map((e) => e.id));
const drafts = loadDraftFiles();
const slugs = args.all ? [...drafts.keys()] : args.only!.split(',').map((s) => s.trim());
for (const slug of slugs) {
  const exercises = drafts.get(slug);
  const question = questions.get(slug);
  if (!exercises) {
    console.error(`✗ ${slug}: черновика нет`);
    failed = true;
    continue;
  }
  if (!question) {
    console.error(`✗ ${slug}: такого вопроса нет в банке`);
    failed = true;
    continue;
  }
  const clash = exercises.filter((e) => taken.has(e.id)).map((e) => e.id);
  if (clash.length) {
    console.error(`✗ ${slug}: id уже заняты в банке: ${clash.join(', ')} — переименуйте в черновике`);
    failed = true;
    continue;
  }

  const target = join(CONTENT_ROOT, 'exercises', `${question.topic}.yaml`);
  const prefix = existsSync(target) && !readFileSync(target, 'utf8').endsWith('\n\n') ? '\n' : '';
  appendFileSync(target, `${prefix}# ${question.slug}: принято из черновика ${new Date().toISOString().slice(0, 10)}\n${stringify(exercises, { lineWidth: 0 })}`);
  unlinkSync(join(DRAFTS_DIR, `${slug}.yaml`));
  for (const e of exercises) taken.add(e.id);
  console.log(`✓ ${slug}: ${exercises.length} упр. → exercises/${question.topic}.yaml`);
}
process.exitCode = failed ? 1 : 0;
