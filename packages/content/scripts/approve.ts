/**
 * Перенос вычитанных черновиков в банк упражнений.
 *
 *   npm run approve -w @rr/content -- --only keys,rules-of-hooks
 *   npm run approve -w @rr/content -- --all
 *
 * Перед переносом черновик ещё раз проверяется: схема, существующий вопрос, уникальные id.
 * Упражнения дописываются в exercises/<тема вопроса>.yaml, файл черновика удаляется.
 * Править упражнения удобнее прямо в черновике, до approve: комментарии ревьюера там же.
 */
import { appendFileSync, existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { stringify } from 'yaml';
import { CONTENT_ROOT, DRAFTS_DIR, loadDraftFiles, loadExercises, loadQuestions } from '../src/node.ts';

const { values: args } = parseArgs({ options: { only: { type: 'string' }, all: { type: 'boolean', default: false } } });
if (!args.only && !args.all) {
  console.error('Укажите --only slug1,slug2 или --all');
  process.exit(1);
}

const questions = new Map(loadQuestions().map((q) => [q.slug, q]));
const taken = new Set(loadExercises().map((e) => e.id));
const drafts = loadDraftFiles();
const slugs = args.all ? [...drafts.keys()] : args.only!.split(',').map((s) => s.trim());

let failed = false;
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
