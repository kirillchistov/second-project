import { expect, test } from 'vitest';
import { reminderPlan } from './reminders.ts';

const base = { hour: 19, minute: 0, goalDoneToday: false, streak: 0, due: 0, backlog: 0 };

test('неделя напоминаний в выбранное время, начиная с сегодня', () => {
  const plan = reminderPlan({ ...base, now: new Date(2026, 9, 13, 10, 0) });
  expect(plan).toHaveLength(7);
  expect(plan[0].date).toEqual(new Date(2026, 9, 13, 19, 0));
  expect(plan[6].date).toEqual(new Date(2026, 9, 19, 19, 0));
});

test('сегодня не напоминает, если цель выполнена или время прошло', () => {
  expect(reminderPlan({ ...base, now: new Date(2026, 9, 13, 10, 0), goalDoneToday: true })[0].date).toEqual(new Date(2026, 9, 14, 19, 0));
  expect(reminderPlan({ ...base, now: new Date(2026, 9, 13, 20, 0) })).toHaveLength(6);
});

test('сегодняшний текст — по самому важному', () => {
  const at = new Date(2026, 9, 13, 10, 0);
  expect(reminderPlan({ ...base, now: at, streak: 5, backlog: 3 })[0].title).toBe('🔥 5 дней подряд');
  expect(reminderPlan({ ...base, now: at, backlog: 3, due: 4 })[0].body).toMatch(/^3 ошибки в backlog/);
  expect(reminderPlan({ ...base, now: at, due: 21 })[0].body).toMatch(/^21 навык пора/);
  // Цель выполнена: завтра напоминаем о серии, которая станет на день длиннее
  expect(reminderPlan({ ...base, now: at, goalDoneToday: true, streak: 4 })[0].title).toBe('🔥 5 дней подряд');
});
