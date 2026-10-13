import { ProgressBar } from '@/components/ui';
import { PATH } from '@/lib/content';
import { fibiFace } from '@/lib/fibi';
import { useNow } from '@/lib/now';
import { useProgress } from '@/lib/progress';
import { MONO, useColors, type Colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { currentStreak, DAILY_GOAL_XP, localDay, lessonStatus, type LessonStatus, type PathLesson, type PathUnit } from '@rr/core';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PathScreen() {
  const c = useColors();
  const { activity, cards } = useProgress();
  const today = localDay(useNow());
  const streak = currentStreak(activity.keys(), today);
  const xpToday = activity.get(today) ?? 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <View style={styles.headerStat}>
          <Ionicons name="flame" size={22} color={streak > 0 ? c.warning : c.textMuted} />
          <Text style={[styles.headerValue, { color: streak > 0 ? c.warning : c.textMuted }]}>{streak}</Text>
        </View>
        <View style={styles.goal}>
          <Text style={[styles.goalText, { color: c.textMuted }]}>
            Цель дня: {Math.min(xpToday, DAILY_GOAL_XP)}/{DAILY_GOAL_XP} XP
          </Text>
          <ProgressBar value={xpToday / DAILY_GOAL_XP} color={c.warning} />
        </View>
        <Text style={[styles.face, { color: c.text }]}>{fibiFace(xpToday >= DAILY_GOAL_XP ? 'proud' : 'idle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {PATH.map((unit) => (
          <Unit key={unit.id} unit={unit} hasSkill={(skill) => cards.has(skill)} c={c} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Unit({ unit, hasSkill, c }: { unit: PathUnit; hasSkill: (skill: string) => boolean; c: Colors }) {
  const statuses = unit.lessons.map((_, i) => lessonStatus(unit, i, hasSkill));
  const completed = statuses.filter((s) => s === 'done').length;
  const released = completed === unit.lessons.length;
  return (
    <View style={styles.unit}>
      <View style={[styles.unitCard, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Text style={[styles.branch, { color: c.accent }]}>feature/{unit.id}</Text>
        <Text style={[styles.unitTitle, { color: c.text }]}>{unit.title}</Text>
        <Text style={[styles.unitGoal, { color: c.textMuted }]}>{unit.goal}</Text>
        <View style={styles.unitProgress}>
          <ProgressBar value={completed / unit.lessons.length} />
          <Text style={[styles.unitCount, { color: c.textMuted }]}>
            {completed}/{unit.lessons.length}
          </Text>
        </View>
      </View>
      <View style={styles.commits}>
        {unit.lessons.map((lesson, i) => (
          <Commit key={lesson.id} lesson={lesson} status={statuses[i]} last={i === unit.lessons.length - 1} c={c} />
        ))}
      </View>
      <View style={[styles.release, { borderColor: released ? c.success : c.border }]}>
        <Ionicons name="pricetag" size={14} color={released ? c.success : c.textMuted} />
        <Text style={[styles.releaseText, { color: released ? c.success : c.textMuted }]}>
          {released ? `Релиз ${unit.title} выпущен` : `Релиз — после ${unit.lessons.length} коммитов`}
        </Text>
      </View>
    </View>
  );
}

function Commit({ lesson, status, last, c }: { lesson: PathLesson; status: LessonStatus; last: boolean; c: Colors }) {
  const color = status === 'done' ? c.success : status === 'next' ? c.accent : c.border;
  const locked = status === 'locked';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityLabel={`Урок ${lesson.index}: ${lesson.questions.map((q) => q.title).join('; ')}`}
      disabled={locked}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/lesson/${lesson.id}`);
      }}
      style={({ pressed }) => [styles.commit, { opacity: locked ? 0.5 : pressed ? 0.7 : 1 }]}
    >
      <View style={styles.rail}>
        <View
          style={[
            styles.node,
            { borderColor: color, backgroundColor: status === 'done' ? c.success : c.bg },
            status === 'next' && styles.nodeNext,
          ]}
        >
          {status === 'done' && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
          {locked && <Ionicons name="lock-closed" size={11} color={c.textMuted} />}
        </View>
        {!last && <View style={[styles.line, { backgroundColor: c.border }]} />}
      </View>
      <View style={[styles.commitBody, status === 'next' && { backgroundColor: c.accentSoft, borderColor: c.accent }, { borderColor: status === 'next' ? c.accent : 'transparent' }]}>
        <Text style={[styles.hash, { color }]}>
          {lesson.hash} · урок {lesson.index}
          {lesson.exercises.length > 0 ? ` · ${lesson.exercises.length} практ.` : ''}
        </Text>
        {lesson.questions.map((q) => (
          <Text key={q.slug} numberOfLines={1} style={[styles.commitTitle, { color: c.text }]}>
            {q.title}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerValue: { fontSize: 18, fontWeight: '800' },
  goal: { flex: 1, gap: 4 },
  goalText: { fontSize: 12, fontWeight: '600' },
  face: { fontSize: 18 },
  content: { padding: 16, gap: 28, paddingBottom: 48 },
  unit: { gap: 12 },
  unitCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 4 },
  branch: { fontFamily: MONO, fontSize: 12, fontWeight: '600' },
  unitTitle: { fontSize: 22, fontWeight: '800' },
  unitGoal: { fontSize: 14, lineHeight: 19 },
  unitProgress: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  unitCount: { fontSize: 13, fontWeight: '600' },
  commits: { paddingLeft: 8 },
  commit: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 26 },
  node: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  nodeNext: { width: 26, height: 26, borderWidth: 5 },
  line: { width: 3, flex: 1, minHeight: 12 },
  commitBody: { flex: 1, borderWidth: 2, borderRadius: 12, padding: 10, marginBottom: 6, gap: 2 },
  hash: { fontFamily: MONO, fontSize: 12, fontWeight: '700' },
  commitTitle: { fontSize: 14, lineHeight: 19 },
  release: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  releaseText: { fontSize: 12, fontWeight: '600' },
});
