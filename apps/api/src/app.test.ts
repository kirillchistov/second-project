import type { Question } from '@rr/content';
import type { GradeResult } from '@rr/core';
import type { Rubric } from '@rr/content/rubrics';
import { describe, expect, test, vi } from 'vitest';
import { createApp } from './app.ts';
import { buildResult, gradePrompt, hintPrompt, type Examiner } from './examiner.ts';

const question = { slug: 'keys', title: 'Зачем нужен key?' } as Question;
const rubric: Rubric = {
  question: 'keys',
  points: [
    { id: 'purpose', text: 'key сопоставляет элементы между рендерами', weight: 3 },
    { id: 'index', text: 'индекс ломается при вставке и удалении', weight: 2 },
    { id: 'reset', text: 'смена key пересоздаёт компонент', weight: 1 },
  ],
  misconceptions: ['key доступен через props.key'],
};

function setup(examiner: Partial<Examiner> = {}, opts: { token?: string; dailyLimit?: number } = {}) {
  const grade = vi.fn(examiner.grade ?? (async () => ({ points: [{ id: 'purpose', status: 'covered' as const }], errors: [], feedback: 'ok', followUp: 'q?' })));
  const hint = vi.fn(examiner.hint ?? (async () => 'Что будет со state при удалении первого элемента?'));
  const app = createApp({ questions: [question], rubrics: [rubric], examiner: { grade, hint }, ...opts });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } });
  return { app, grade, hint, post };
}

const answer = 'Ключ нужен, чтобы React понимал, какой элемент списка какой между рендерами.';

describe('POST /v1/grade', () => {
  test('оценка считается по рубрике, нераскрытые пункты — missing', async () => {
    const { post } = setup();
    const res = await post('/v1/grade', { question: 'keys', answer });
    expect(res.status).toBe(200);
    const body = (await res.json()) as GradeResult;
    expect(body.points.map((p) => p.status)).toEqual(['covered', 'missing', 'missing']);
    expect(body.score).toBe(50);
    expect(body.verdict).toBe('partial');
    expect(body.outcome).toBe('hard');
  });

  test('короткий ответ не уходит в модель', async () => {
    const { post, grade } = setup();
    const body = await (await post('/v1/grade', { question: 'keys', answer: 'не знаю' })).json();
    expect(grade).not.toHaveBeenCalled();
    expect(body).toMatchObject({ score: 0, verdict: 'weak', outcome: 'again' });
  });

  test('неизвестный вопрос и кривое тело запроса', async () => {
    const { post } = setup();
    expect((await post('/v1/grade', { question: 'nope', answer })).status).toBe(404);
    expect((await post('/v1/grade', { answer })).status).toBe(400);
  });

  test('сбой модели — 502, а не падение сервера', async () => {
    const { post } = setup({ grade: async () => Promise.reject(new Error('boom')) });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await post('/v1/grade', { question: 'keys', answer })).status).toBe(502);
  });
});

describe('доступ и квота', () => {
  test('с токеном без заголовка — 401', async () => {
    const { post } = setup({}, { token: 'secret' });
    expect((await post('/v1/grade', { question: 'keys', answer })).status).toBe(401);
    expect((await post('/v1/grade', { question: 'keys', answer }, { authorization: 'Bearer secret' })).status).toBe(200);
  });

  test('дневной лимит считается по устройству', async () => {
    const { post } = setup({}, { dailyLimit: 2 });
    const as = (device: string) => post('/v1/hint', { question: 'keys' }, { 'x-device-id': device });
    expect((await as('a')).status).toBe(200);
    expect((await as('a')).status).toBe(200);
    expect((await as('a')).status).toBe(429);
    expect((await as('b')).status).toBe(200);
  });
});

test('подсказка возвращает наводящий вопрос', async () => {
  const { post, hint } = setup();
  const body = (await (await post('/v1/hint', { question: 'keys', answer: '', level: 2 })).json()) as { hint: string };
  expect(body.hint).toMatch(/\?$/);
  expect(hint).toHaveBeenCalledWith(question, rubric, '', 2);
});

test('промпты содержат рубрику, заблуждения и ответ', () => {
  const prompt = gradePrompt(question, rubric, answer);
  expect(prompt).toContain('[purpose] (вес 3)');
  expect(prompt).toContain('props.key');
  expect(prompt).toContain(answer);
  expect(hintPrompt(question, rubric, '', 3)).toContain('(пока ничего)');
});

test('ошибка в ответе не даёт «хорошо» даже при всех пунктах', () => {
  const all = rubric.points.map((p) => ({ id: p.id, status: 'covered' as const }));
  expect(buildResult(rubric, { points: all, errors: [], feedback: '', followUp: '' }, 0).verdict).toBe('good');
  expect(buildResult(rubric, { points: all, errors: ['key доступен через props'], feedback: '', followUp: '' }, 0).verdict).toBe('partial');
});
