import { LessonItemView } from '@/components/exercises/LessonItemView';
import { Button, InlineText, ProgressBar } from '@/components/ui';
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
  CHEST_XP,
  currentStreak,
  QUEST_XP,
  lessonItems,
  localDay,
  reviewItems,
  sessionProgress,
  sessionReducer,
  startSession,
  type AnswerMeta,
  type LessonItem,
  type Outcome,
} from '@rr/core';
import { burst, celebrate } from '@/lib/confetti';
import { ScrollLockContext } from '@/lib/scrollLock';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Урок мог открыться первым экраном (по ссылке или после перезагрузки) — тогда возвращаться некуда, идём на путь. */
function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** «Идеальный коммит»: золотой заголовок выпрыгивает пружиной и мягко пульсирует, пока открыт экран. */
function PerfectTitle() {
  const c = useColors();
  const [pop] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        pop.setValue(1);
        return;
      }
      Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
    });
    return () => loop?.stop();
  }, [pop, pulse]);
  const scale = Animated.multiply(
    pop.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }),
    pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }),
  );
  return (
    <Animated.View accessibilityRole="header" style={{ opacity: pop, transform: [{ scale }], alignItems: 'center', gap: 2 }}>
      <Text style={[styles.title, { color: c.warning }]}>✦ Идеальный коммит ✦</Text>
      <Text style={[styles.perfectSub, { color: c.textMuted }]}>ни одной ошибки — merge без ревью</Text>
    </Animated.View>
  );
}

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // В ландшафте вырез камеры сбоку: боковые отступы из safe area, панель разбора — не выше трети экрана
  const sides = { paddingLeft: insets.left, paddingRight: insets.right };
  const feedbackMaxHeight = Math.min(220, height * 0.3);
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
  const [saveFailed, setSaveFailed] = useState(false);
  const savingRef = useRef(false);
  const [scrollLocked, setScrollLocked] = useState(false);

  const item = currentItem(state);

  useEffect(() => {
    if (state.phase !== 'done' || savingRef.current || items.length === 0) return;
    savingRef.current = true;
    progress
      .save(state, lesson?.id ?? null)
      .then((result) => {
        setSaved(result);
        Haptics.notificationAsync(result.perfect ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning);
        // Идеальный коммит — салют; повторение и урок с ошибками — скромный хлопок
        if (result.perfect && !isReview) celebrate();
        else burst();
      })
      .catch((error) => {
        console.error('Не удалось сохранить урок', error);
        setSaveFailed(true);
      });
  }, [state, items.length, lesson?.id, progress, isReview]);

  const answer = (outcome: Outcome, feedback: boolean, meta?: AnswerMeta) => {
    if (!item) return;
    const correct = outcome !== 'again';
    if (correct) burst();
    if (!feedback) {
      // Самооценка или разбор ИИ: результат уже на экране — отдельная панель не нужна
      dispatch({ type: 'answer', outcome, meta });
      dispatch({ type: 'continue' });
      return;
    }
    Haptics.notificationAsync(correct ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
    dispatch({ type: 'answer', outcome, meta });
  };

  if (items.length === 0) {
    return (
      <View style={[styles.center, sides, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.face, { color: c.text }]}>{fibiFace('proud')}</Text>
        <Text style={[styles.title, { color: c.text }]}>Повторять пока нечего</Text>
        <Text style={[styles.muted, { color: c.textMuted }]}>Пройди урок на пути — навыки появятся здесь, когда придёт время их освежить.</Text>
        <Button title="Назад" onPress={leave} style={styles.wide} />
      </View>
    );
  }

  if (state.phase === 'done') {
    const streak = currentStreak(progress.activity.keys(), localDay(now), progress.frozenDays);
    return (
      <View style={[styles.center, sides, { backgroundColor: c.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}>
        <Text style={[styles.face, { color: c.text }]}>{fibiFace(saved?.perfect ? 'proud' : 'happy')}</Text>
        {!isReview && saved?.perfect ? (
          <PerfectTitle />
        ) : (
          <Text style={[styles.title, { color: c.text }]}>{isReview ? 'Повторение завершено' : 'Коммит принят'}</Text>
        )}
        {lesson && <Text style={[styles.hash, { color: c.textMuted }]}>commit {lesson.hash}</Text>}
        {saved && (
          <View style={styles.stats}>
            <Stat label="XP" value={`+${saved.xp}`} color={c.warning} />
            <Stat label="С первой попытки" value={`${Math.round(saved.accuracy * 100)}%`} color={c.success} />
            <Stat label="Стрик" value={`${streak} дн.`} color={c.accent} />
          </View>
        )}
        {saved && (saved.quests.length > 0 || saved.chest) && (
          <View style={[styles.rewards, { borderColor: c.border, backgroundColor: c.surface }]}>
            {saved.quests.map((q) => (
              <View key={q.id} style={styles.reward}>
                <Ionicons name="checkmark-circle" size={20} color={c.success} />
                <Text style={[styles.rewardText, { color: c.text }]}>{q.title}</Text>
                <Text style={[styles.rewardXp, { color: c.warning }]}>+{QUEST_XP} XP</Text>
              </View>
            ))}
            {saved.chest && (
              <View style={styles.reward}>
                <Ionicons name="gift" size={20} color={c.accent} />
                <Text style={[styles.rewardText, { color: c.text }]}>
                  {saved.chest === 'stash' ? 'Сундук: +1 git stash — заморозка стрика на пропущенный день' : 'Сундук: запас заморозок полон'}
                </Text>
                {saved.chest === 'xp' && <Text style={[styles.rewardXp, { color: c.warning }]}>+{CHEST_XP} XP</Text>}
              </View>
            )}
          </View>
        )}
        {saveFailed && (
          <Text style={[styles.muted, { color: c.danger }]}>Не удалось сохранить прогресс урока. Попробуй пройти его ещё раз.</Text>
        )}
        <Button title="Готово" onPress={leave} disabled={!saved && !saveFailed} style={styles.wide} />
      </View>
    );
  }

  const revealed = state.phase === 'feedback';
  // Что разбирать: упражнение или карточку, пройденную через варианты
  const graded = item?.kind === 'exercise' ? item.exercise : item?.quiz;
  const repeat = item ? state.results[item.id] !== undefined && !revealed : false;
  const discussSlug = item ? (item.kind === 'exercise' ? item.exercise.question : item.question.slug) : undefined;

  return (
    <View style={[styles.root, sides, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Закрыть урок" onPress={leave} hitSlop={12}>
          <Ionicons name="close" size={28} color={c.textMuted} />
        </Pressable>
        <ProgressBar value={sessionProgress(state)} />
        {state.combo >= 3 && <Text style={[styles.combo, { color: c.warning }]}>×{state.combo}</Text>}
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        scrollEnabled={!scrollLocked}
      >
        {repeat && <Text style={[styles.repeat, { color: c.warning }]}>Повтор ошибки</Text>}
        <ScrollLockContext value={setScrollLocked}>
          {item && <LessonItemView key={`${item.id}:${state.position}`} item={item} revealed={revealed} onAnswer={answer} />}
        </ScrollLockContext>
      </ScrollView>

      {revealed && graded && state.last && (
        <View
          style={[styles.feedback, { backgroundColor: state.last.correct ? c.successSoft : c.dangerSoft, paddingBottom: insets.bottom + 12 }]}
        >
          <Text style={[styles.feedbackTitle, { color: state.last.correct ? c.success : c.danger }]}>
            {fibiFace(state.last.correct ? 'happy' : 'sad')}  {fibiLine(state.last.correct, state.combo, state.position)}
          </Text>
          <ScrollView style={{ maxHeight: feedbackMaxHeight }}>
            {!state.last.correct && (
              <InlineText text={`Правильно: ${correctAnswerText(graded)}`} style={[styles.feedbackAnswer, { color: c.text }]} />
            )}
            <InlineText text={graded.explanation} style={[styles.feedbackText, { color: c.text }]} />
            {discussSlug && (
              // Обсуждения открываются поверх урока: вернувшись, продолжишь с того же места
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(`/forum/about/${discussSlug}`)}
                style={styles.discuss}
                hitSlop={8}
              >
                <Ionicons name="chatbubbles-outline" size={16} color={c.accent} />
                <Text style={[styles.discussText, { color: c.accent }]}>Обсудить вопрос на форуме</Text>
              </Pressable>
            )}
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
  feedbackTitle: { fontSize: 18, fontWeight: '800' },
  feedbackAnswer: { fontSize: 15, lineHeight: 21, fontWeight: '600', marginBottom: 6 },
  feedbackText: { fontSize: 15, lineHeight: 21 },
  face: { fontSize: 44 },
  perfectSub: { fontSize: 13, fontWeight: '600' },
  discuss: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  discussText: { fontSize: 14, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
  hash: { fontFamily: 'Menlo', fontSize: 14 },
  muted: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 10, marginVertical: 12 },
  rewards: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 14, padding: 12, gap: 10, marginBottom: 12 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rewardText: { flex: 1, fontSize: 14, fontWeight: '600' },
  rewardXp: { fontSize: 14, fontWeight: '800' },
  stat: { borderWidth: 2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center', minWidth: 96 },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, textAlign: 'center' },
  wide: { alignSelf: 'stretch' },
});
