/**
 * Напоминания от Fibi: локальные уведомления на неделю вперёд в выбранное время.
 * Расписание пересчитывается после каждого урока и при открытии приложения,
 * поэтому сегодняшнее напоминание не придёт, если цель дня уже выполнена.
 */

export interface ReminderState {
  now: Date;
  /** Время напоминания по часам пользователя */
  hour: number;
  minute: number;
  goalDoneToday: boolean;
  /** Стрик с учётом сегодняшнего дня */
  streak: number;
  /** Навыков, которые пора повторить */
  due: number;
  backlog: number;
  /** На сколько дней вперёд ставить: без открытия приложения напоминания не прекращаются сразу, но и не вечны */
  days?: number;
}

export interface Reminder {
  date: Date;
  title: string;
  body: string;
}

export const REMINDER_DAYS = 7;
export const DEFAULT_REMINDER = { hour: 19, minute: 0 } as const;

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/** Текст на сегодня: по самому важному — серия под угрозой, ошибки, забытое. */
function todayText(state: ReminderState): Omit<Reminder, 'date'> {
  if (state.streak > 0) {
    const days = `${state.streak} ${plural(state.streak, 'день', 'дня', 'дней')}`;
    return { title: `🔥 ${days} подряд`, body: 'Серия ещё не закоммичена. Один урок — и она в безопасности. (•‿•)' };
  }
  if (state.backlog > 0) {
    const bugs = `${state.backlog} ${plural(state.backlog, 'ошибка', 'ошибки', 'ошибок')}`;
    return { title: 'Bug Backlog ждёт', body: `${bugs} в backlog. Закроем пару, пока они свежие? (•︵•)` };
  }
  if (state.due > 0) {
    const skills = `${state.due} ${plural(state.due, 'навык', 'навыка', 'навыков')}`;
    return { title: 'Твой useEffect протух', body: `${skills} пора освежить — это 3 минуты. (•‿•)` };
  }
  return { title: 'Fibi скучает', body: 'Пять минут на React сегодня — и завтра вспомнишь больше. (•‿•)' };
}

/** На будущие дни состояние неизвестно — общие реплики, разные по дням. */
const LATER: readonly Omit<Reminder, 'date'>[] = [
  { title: 'Время коммита', body: 'Один урок — одна зелёная клетка в графе. (•‿•)' },
  { title: 'Fibi на связи', body: 'Знания тоже нуждаются в ререндере. 3 минуты? (◕‿◕)' },
  { title: 'Повторение — мать reconciliation', body: 'Освежим то, что начинает забываться. (•‿•)' },
  { title: 'Стрик ждёт', body: 'Без урока серия уйдёт в detached HEAD. (•︵•)' },
];

export function reminderPlan(state: ReminderState): Reminder[] {
  const { now, hour, minute } = state;
  const plan: Reminder[] = [];
  for (let offset = 0; offset < (state.days ?? REMINDER_DAYS); offset++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute);
    if (offset === 0 && (state.goalDoneToday || date <= now)) continue;
    // Завтра серия ещё жива, только если сегодня занимались, — тогда напоминаем о ней
    const text =
      offset === 0
        ? todayText(state)
        : offset === 1 && state.goalDoneToday && state.streak > 0
          ? todayText({ ...state, streak: state.streak + 1 })
          : LATER[(now.getDate() + offset) % LATER.length];
    plan.push({ date, ...text });
  }
  return plan;
}
