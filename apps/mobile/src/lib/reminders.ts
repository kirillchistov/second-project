import type { ProgressSnapshot } from '@/lib/db';
import {
  currentStreak,
  DAILY_GOAL_XP,
  DEFAULT_REMINDER,
  dueCount,
  localDay,
  reminderPlan,
} from '@rr/core';
import * as Notifications from 'expo-notifications';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';

/**
 * Напоминания от Fibi — локальные уведомления, без сервера и push-токенов.
 * Настройка хранится в kv-store; расписание пересчитывается при каждом изменении прогресса.
 */
export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

const KEY = 'reminders';
const listeners = new Set<() => void>();

function read(): ReminderSettings {
  try {
    const raw = Storage.getItemSync(KEY);
    if (raw) return { enabled: false, ...DEFAULT_REMINDER, ...(JSON.parse(raw) as Partial<ReminderSettings>) };
  } catch {
    // битая запись — настройки по умолчанию
  }
  return { enabled: false, ...DEFAULT_REMINDER };
}

let settings = read();

export function useReminderSettings(): ReminderSettings {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => settings,
  );
}

function store(next: ReminderSettings) {
  settings = next;
  Storage.setItemSync(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

// Пока приложение открыто, баннер не нужен: пользователь и так в нём
Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

/** Включить напоминания: сначала разрешение iOS. Отказ — настройка остаётся выключенной. */
export async function enableReminders(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted = current.granted || (current.canAskAgain && (await Notifications.requestPermissionsAsync()).granted);
  if (!granted) return false;
  store({ ...settings, enabled: true });
  return true;
}

export async function disableReminders(): Promise<void> {
  store({ ...settings, enabled: false });
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function setReminderTime(hour: number, minute: number) {
  store({ ...settings, hour, minute });
}

/** Переставить уведомления по текущему прогрессу. Вызывается после загрузки и каждого сохранения. */
export async function syncReminders(progress: ProgressSnapshot, now: Date): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.enabled) return;
  const today = localDay(now);
  const plan = reminderPlan({
    now,
    hour: settings.hour,
    minute: settings.minute,
    goalDoneToday: (progress.activity.get(today) ?? 0) >= DAILY_GOAL_XP,
    streak: currentStreak(progress.activity.keys(), today, progress.frozenDays),
    due: dueCount(progress.cards, now),
    backlog: progress.backlog.length,
  });
  for (const r of plan) {
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
    });
  }
}
