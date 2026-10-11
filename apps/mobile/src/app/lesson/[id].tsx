import { LessonItemView } from '@/components/exercises/LessonItemView';
import { Button, ProgressBar } from '@/components/ui';
import { CONTENT, lessonById } from '@/lib/content';
import type { SavedLesson } from '@/lib/db';
import { fibiFace, fibiLine } from '@/lib/fibi';
import { useNow } from '@/lib/now';
import { useProgress } from '@/lib/progress';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  correctAnswerText,
  currentItem,
  currentStreak,
  lessonItems,
  localDay,
  reviewItems,
  sessionProgress,
  sessionReducer,
  startSession,
  type LessonItem,
  type Outcome,
} from '@rr/core';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const progress = useProgress();
  const now = useNow();
  const isReview = id === 'review';
  const lesson = isReview ? undefined : lessonById.get(id);

  // Состав урока фиксируется при открытии: сохранение прогресса посреди урока не должно его менять
  const [items] = useState<LessonItem[]>(() =>
    lesson ? lessonItems(lesson) : reviewItems({ content: CONTENT, cards: progress.cards, backlog: progress.backlog, now }),
  );
  const [state, dispatch] = useReducer(sessionReducer, items, startSession);
  const [saved, setSaved] = useState<SavedLesson | null>(null);
  const savingRef = useRef(false);

  const item = currentItem(state);

  useEffect(() => {
    if (state.phase !== 'done' || savingRef.current || items.length === 0) return;
    savingRef.current = true;
    progress.save(state, lesson?.id ?? null).then((result) => {
      setSaved(result);
      Haptics.notificationAsync(result.perfect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
    });
  }, [state, items.length, lesson?.id, progress]);

  const answer = (outcome: Outcome, feedback: boolean) => {
    if (!item) return;
    const correct = outcome !== 'again';
    if (!feedback) {
      // Самооценка: эталон уже на экране — отдельный разбор не нужен
      dispatch({ type: 'answer', outcome });
      dispatch({ type: 'continue' });
      return;
    }
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    dispatch({ type: 'answer', outcome });
  };

  if (items.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.face, { color: c.text }]}>{fibiFace('proud')}</Text>
        <Text style={[styles.title, { color: c.text }]}>Повторять пока нечего</Text>
        <Text style={[styles.muted, { color: c.textMuted }]}>Пройди урок на пути — навыки появятся здесь, когда придёт время их освежить.</Text>
        <Button title="Назад" onPress={() => router.back()} style={styles.wide} />
      </View>
    );
  }

  if (state.phase === 'done') {
    const streak = currentStreak(progress.activity.keys(), localDay(now));
    return (
      <View style={[styles.center, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.face, { color: c.text }]}>{fibiFace(saved?.perfect ? 'proud' : 'happy')}</Text>
        <Text style={[styles.title, { color: c.text }]}>
          {isReview ? 'Повторение завершено' : saved?.perfect ? 'Идеальный коммит!' : 'Коммит принят'}
        </Text>
        {lesson && <Text style={[styles.hash, { color: c.textMuted }]}>commit {lesson.hash}</Text>}
        {saved && (
          <View style={styles.stats}>
            <Stat label="XP" value={`+${saved.xp}`} color={c.warning} />
            <Stat label="С первой попытки" value={`${Math.round(saved.accuracy * 100)}%`} color={c.success} />
            <Stat label="Стрик" value={`${streak} дн.`} color={c.accent} />
          </View>
        )}
        <Button title="Готово" onPress={() => router.back()} disabled={!saved} style={styles.wide} />
      </View>
    );
  }

  const revealed = state.phase === 'feedback';
  // Что разбирать: упражнение или карточку, пройденную через варианты
  const graded = item?.kind === 'exercise' ? item.exercise : item?.quiz;
  const repeat = item ? state.results[item.id] !== undefined && !revealed : false;

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть урок" onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={28} color={c.textMuted} />
        </Pressable>
        <ProgressBar value={sessionProgress(state)} />
        {state.combo >= 3 && <Text style={[styles.combo, { color: c.warning }]}>×{state.combo}</Text>}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]} keyboardShouldPersistTaps="handled">
        {repeat && <Text style={[styles.repeat, { color: c.warning }]}>Повтор ошибки</Text>}
        {item && <LessonItemView key={`${item.id}:${state.position}`} item={item} revealed={revealed} onAnswer={answer} />}
      </ScrollView>

      {revealed && graded && state.last && (
        <View
          style={[styles.feedback, { backgroundColor: state.last.correct ? c.successSoft : c.dangerSoft, paddingBottom: insets.bottom + 12 }]}
        >
          <Text style={[styles.feedbackTitle, { color: state.last.correct ? c.success : c.danger }]}>
            {fibiFace(state.last.correct ? 'happy' : 'sad')}  {fibiLine(state.last.correct, state.combo, state.position)}
          </Text>
          <ScrollView style={styles.feedbackScroll}>
            {!state.last.correct && (
              <Text style={[styles.feedbackAnswer, { color: c.text }]}>Правильно: {correctAnswerText(graded)}</Text>
            )}
            <Text style={[styles.feedbackText, { color: c.text }]}>{graded.explanation}</Text>
          </ScrollView>
          <Button
            title="Дальше"
            variant={state.last.correct ? 'success' : 'danger'}
            onPress={() => dispatch({ type: 'continue' })}
          />
        </View>
      )}
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  const c = useColors();
  return (
    <View style={[styles.stat, { borderColor: color, backgroundColor: c.surface }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 10 },
  combo: { fontWeight: '800', fontSize: 16 },
  content: { padding: 16 },
  repeat: { fontWeight: '700', fontSize: 13, textTransform: 'uppercase', marginBottom: 8, letterSpacing: 0.5 },
  feedback: { padding: 16, gap: 10, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  feedbackScroll: { maxHeight: 220 },
  feedbackTitle: { fontSize: 18, fontWeight: '800' },
  feedbackAnswer: { fontSize: 15, lineHeight: 21, fontWeight: '600', marginBottom: 6 },
  feedbackText: { fontSize: 15, lineHeight: 21 },
  face: { fontSize: 44 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  hash: { fontFamily: 'Menlo', fontSize: 14 },
  muted: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  stat: { borderWidth: 2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', minWidth: 96 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
});
