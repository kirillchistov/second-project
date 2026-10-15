import Ionicons from '@expo/vector-icons/Ionicons';
import { PATH } from '@/lib/content';
import { useNow } from '@/lib/now';
import { setCardMode, useCardMode, type CardMode } from '@/lib/preferences';
import { signOut } from '@/lib/account';
import { useProgress } from '@/lib/progress';
import { useAccount } from '@/lib/session';
import { router } from 'expo-router';
import { Button } from '@/components/ui';
import { disableReminders, enableReminders, setReminderTime, useReminderSettings } from '@/lib/reminders';
import { useColors, type Colors } from '@/lib/theme';
import { addDays, currentStreak, DAILY_GOAL_XP, isLearned, isLessonDone, localDay, longestStreak, retrievability, STASH_MAX } from '@rr/core';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const WEEKS = 15;

/** Цвет клетки: как в GitHub, но порог — дневная цель. */
function heatLevel(xp: number): number {
  if (xp <= 0) return 0;
  if (xp < DAILY_GOAL_XP / 2) return 1;
  if (xp < DAILY_GOAL_XP) return 2;
  if (xp < DAILY_GOAL_XP * 2) return 3;
  return 4;
}

function ContributionGraph({ activity, now, c }: { activity: ReadonlyMap<string, number>; now: Date; c: Colors }) {
  const today = localDay(now);
  // Последняя колонка — текущая неделя, недели начинаются с понедельника
  const weekday = (now.getDay() + 6) % 7;
  const start = addDays(today, -(WEEKS - 1) * 7 - weekday);
  return (
    <View style={styles.graph}>
      {Array.from({ length: WEEKS }, (_, w) => (
        <View key={w} style={styles.week}>
          {Array.from({ length: 7 }, (_, d) => {
            const day = addDays(start, w * 7 + d);
            const future = day > today;
            return (
              <View
                key={d}
                style={[styles.cell, { backgroundColor: future ? 'transparent' : c.heat[heatLevel(activity.get(day) ?? 0)] }]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const CARD_MODES: { id: CardMode; label: string; hint: string }[] = [
  { id: 'ask', label: 'Спрашивать', hint: 'выбирать на каждой карточке' },
  { id: 'voice', label: 'Рассказать, ИИ проверит', hint: 'лучшая тренировка, нужна сеть' },
  { id: 'explain', label: 'Про себя, потом сверить', hint: 'без сети, самооценка' },
  { id: 'quiz', label: 'Выбрать из вариантов', hint: 'быстро, когда неудобно говорить' },
];

function CardModeSetting({ c }: { c: Colors }) {
  const mode = useCardMode();
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.panelTitle, { color: c.text }]}>Карточки вопросов</Text>
      <View style={styles.modes}>
        {CARD_MODES.map((m) => {
          const selected = mode === m.id;
          return (
            <Pressable
              key={m.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setCardMode(m.id)}
              style={[styles.modeRow, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent' }]}
            >
              <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? c.accent : c.textMuted} />
              <View style={styles.modeText}>
                <Text style={[styles.modeLabel, { color: c.text }]}>{m.label}</Text>
                <Text style={[styles.note, { color: c.textMuted }]}>{m.hint}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Аккаунт: вход для гостя; ник, синхронизация и выход для вошедшего */
function AccountPanel({ c }: { c: Colors }) {
  const account = useAccount();
  const { sync } = useProgress();
  const [syncing, setSyncing] = useState(false);
  if (account.status === 'loading') return null;
  if (account.status === 'guest') {
    return (
      <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.panelTitle, { color: c.text }]}>Аккаунт</Text>
        <Text style={[styles.note, { color: c.textMuted }]}>
          Прогресс пока живёт только на этом телефоне. С аккаунтом он сохранится на сервере, а в «Лиге» появятся друзья.
        </Text>
        <Button title="Войти или создать аккаунт" onPress={() => router.push('/account')} />
      </View>
    );
  }
  const synced = account.syncedAt
    ? `Синхронизировано в ${new Date(account.syncedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : 'Ещё не синхронизировано';
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.switchRow}>
        <Ionicons name="person-circle" size={40} color={c.accent} />
        <View style={styles.modeText}>
          <Text style={[styles.panelTitle, { color: c.text }]}>{account.user.nickname}</Text>
          <Text style={[styles.note, { color: c.textMuted }]}>{account.user.email}</Text>
        </View>
      </View>
      <Text style={[styles.note, { color: account.syncError ? c.danger : c.textMuted }]}>{account.syncError ?? synced}</Text>
      <View style={styles.times}>
        <Button
          title={syncing ? 'Обновляю…' : 'Обновить'}
          variant="secondary"
          disabled={syncing}
          style={styles.flex}
          onPress={async () => {
            setSyncing(true);
            await sync();
            setSyncing(false);
          }}
        />
        <Button title="Выйти" variant="secondary" style={styles.flex} onPress={() => void signOut()} />
      </View>
    </View>
  );
}

const REMINDER_TIMES = [
  { hour: 8, minute: 30 },
  { hour: 13, minute: 0 },
  { hour: 19, minute: 0 },
  { hour: 21, minute: 30 },
];

function formatTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, '0')}`;
}

function ReminderSetting({ c }: { c: Colors }) {
  const settings = useReminderSettings();
  const [denied, setDenied] = useState(false);
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <View style={styles.switchRow}>
        <View style={styles.modeText}>
          <Text style={[styles.panelTitle, { color: c.text }]}>Напоминания от Fibi</Text>
          <Text style={[styles.note, { color: c.textMuted }]}>Раз в день, если цель дня ещё не выполнена</Text>
        </View>
        <Switch
          accessibilityLabel="Напоминания от Fibi"
          value={settings.enabled}
          onValueChange={async (on) => {
            if (on) setDenied(!(await enableReminders()));
            else await disableReminders();
          }}
        />
      </View>
      {denied && (
        <Text style={[styles.note, { color: c.danger }]}>
          Уведомления запрещены. Разреши их в Настройках iOS → React Refresher → Уведомления.
        </Text>
      )}
      {settings.enabled && (
        <View style={styles.times}>
          {REMINDER_TIMES.map((t) => {
            const selected = settings.hour === t.hour && settings.minute === t.minute;
            const label = formatTime(t.hour, t.minute);
            return (
              <Pressable
                key={label}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`Напоминать в ${label}`}
                onPress={() => setReminderTime(t.hour, t.minute)}
                style={[styles.time, { borderColor: selected ? c.accent : c.border, backgroundColor: selected ? c.accentSoft : 'transparent' }]}
              >
                <Text style={[styles.modeLabel, { color: selected ? c.accent : c.text }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function ProfileScreen() {
  const c = useColors();
  const { activity, cards, voice, frozenDays, stash } = useProgress();
  const now = useNow();
  const totalXp = [...activity.values()].reduce((a, b) => a + b, 0);
  const learned = [...cards.values()].filter(isLearned).length;
  const reviewed = [...cards.values()].filter((card) => card.reps > 0);
  const memory = reviewed.length ? reviewed.reduce((sum, card) => sum + retrievability(card, now), 0) / reviewed.length : 0;

  const stats = [
    { label: 'Стрик', value: `${currentStreak(activity.keys(), localDay(now), frozenDays)}` },
    { label: 'git stash в запасе', value: `${stash}/${STASH_MAX}` },
    { label: 'Рекорд', value: `${longestStreak(activity.keys(), frozenDays)}` },
    { label: 'Всего XP', value: `${totalXp}` },
    { label: 'Уроков', value: `${PATH.flatMap((u) => u.lessons).filter((l) => isLessonDone(l, (skill) => cards.has(skill))).length}` },
    { label: 'Навыков выучено', value: `${learned}/${cards.size}` },
    { label: 'Помнишь сейчас', value: reviewed.length ? `${Math.round(memory * 100)}%` : '—' },
    {
      label: voice.answers ? `Без подсказок (из ${voice.answers})` : 'Без подсказок',
      value: voice.answers ? `${Math.round((voice.withoutHints / voice.answers) * 100)}%` : '—',
    },
    { label: 'Ответов голосом', value: `${voice.answers}` },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Профиль</Text>
        <AccountPanel c={c} />
        <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.panelTitle, { color: c.text }]}>Активность</Text>
          <ContributionGraph activity={activity} now={now} c={c} />
        </View>
        <View style={styles.grid}>
          {stats.map((s) => (
            <View key={s.label} style={[styles.stat, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
        <CardModeSetting c={c} />
        <ReminderSetting c={c} />
        <Text style={[styles.note, { color: c.textMuted }]}>
          «Помнишь сейчас» — средняя вероятность вспомнить пройденные навыки по модели FSRS. Повторение поднимает её
          обратно к 90%. «Без подсказок» — доля ответов голосом, данных без единого наводящего вопроса: чем выше, тем
          больше ты думаешь сам. git stash — заморозка стрика: если пропустишь день, она закроет его сама. Новую
          даёт сундук за все квесты дня, в запасе — не больше {STASH_MAX}.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  panel: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 10 },
  panelTitle: { fontSize: 16, fontWeight: '700' },
  graph: { flexDirection: 'row', gap: 4, justifyContent: 'space-between' },
  week: { gap: 4 },
  cell: { width: 16, height: 16, borderRadius: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '48%', flexGrow: 1, borderWidth: 1, borderRadius: 14, padding: 14, gap: 2 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 13 },
  note: { fontSize: 13, lineHeight: 18 },
  modes: { gap: 8 },
  modeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, padding: 10 },
  modeText: { flex: 1, gap: 1 },
  modeLabel: { fontSize: 15, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  times: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
  time: { flex: 1, alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingVertical: 10 },
});
