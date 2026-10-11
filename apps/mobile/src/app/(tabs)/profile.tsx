import { useNow } from '@/lib/now';
import { setCardMode, useCardMode, type CardMode } from '@/lib/preferences';
import { useProgress } from '@/lib/progress';
import { useColors, type Colors } from '@/lib/theme';
import { addDays, currentStreak, DAILY_GOAL_XP, isLearned, localDay, longestStreak, retrievability } from '@rr/core';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const CARD_MODES: { id: CardMode; label: string }[] = [
  { id: 'ask', label: 'Спрашивать' },
  { id: 'explain', label: 'Своими словами' },
  { id: 'quiz', label: 'С вариантами' },
];

function CardModeSetting({ c }: { c: Colors }) {
  const mode = useCardMode();
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Text style={[styles.panelTitle, { color: c.text }]}>Карточки вопросов</Text>
      <View style={[styles.segment, { backgroundColor: c.surfaceAlt }]}>
        {CARD_MODES.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            accessibilityState={{ selected: mode === m.id }}
            onPress={() => setCardMode(m.id)}
            style={[styles.segmentItem, mode === m.id && { backgroundColor: c.surface }]}
          >
            <Text style={[styles.segmentText, { color: mode === m.id ? c.text : c.textMuted }]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.note, { color: c.textMuted }]}>
        Свой ответ сильнее закрепляет память; варианты — быстрый режим, когда нет возможности подумать вслух.
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const c = useColors();
  const { activity, cards, lessonsDone } = useProgress();
  const now = useNow();
  const totalXp = [...activity.values()].reduce((a, b) => a + b, 0);
  const learned = [...cards.values()].filter(isLearned).length;
  const reviewed = [...cards.values()].filter((card) => card.reps > 0);
  const memory = reviewed.length ? reviewed.reduce((sum, card) => sum + retrievability(card, now), 0) / reviewed.length : 0;

  const stats = [
    { label: 'Стрик', value: `${currentStreak(activity.keys(), localDay(now))}` },
    { label: 'Рекорд', value: `${longestStreak(activity.keys())}` },
    { label: 'Всего XP', value: `${totalXp}` },
    { label: 'Уроков', value: `${lessonsDone.size}` },
    { label: 'Навыков выучено', value: `${learned}/${cards.size}` },
    { label: 'Помнишь сейчас', value: reviewed.length ? `${Math.round(memory * 100)}%` : '—' },
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Профиль</Text>
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
        <Text style={[styles.note, { color: c.textMuted }]}>
          «Помнишь сейчас» — средняя вероятность вспомнить пройденные навыки по модели FSRS. Повторение поднимает её
          обратно к 90%.
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
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },
});
