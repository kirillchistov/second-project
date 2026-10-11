import { Button, InlineText, Prompt } from '@/components/ui';
import { ApiError, askHint, gradeAnswer } from '@/lib/api';
import { termsFrom, useDictation } from '@/lib/speech';
import { MONO, useColors, type Colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Question } from '@rr/content';
import { MIN_ANSWER_CHARS, type AnswerMeta, type GradeResult, type Outcome, type PointStatus } from '@rr/core';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

const MAX_HINT_LEVEL = 3;

/**
 * «Объясни голосом»: рассказать ответ, получить разбор по рубрике от ИИ.
 * ИИ — экзаменатор, а не подсказчик: до проверки он только задаёт наводящие вопросы, и каждая подсказка снижает зачёт.
 */
export function VoiceExercise({
  question,
  label,
  onAnswer,
  onFallback,
}: {
  question: Question;
  label: string;
  onAnswer: (outcome: Outcome, meta: AnswerMeta) => void;
  /** Проверка недоступна — перейти к самооценке */
  onFallback: () => void;
}) {
  const c = useColors();
  const [text, setText] = useState('');
  const [hints, setHints] = useState<string[]>([]);
  const [busy, setBusy] = useState<'grade' | 'hint' | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<GradeResult | null>(null);
  const terms = useMemo(() => termsFrom(`${question.short}\n${question.body}`), [question]);
  const dictation = useDictation(text, setText, terms);

  const listening = dictation.state === 'listening';
  const meta: AnswerMeta = { mode: 'voice', hints: hints.length };

  async function grade() {
    if (listening) dictation.stop();
    setBusy('grade');
    setError(null);
    try {
      const graded = await gradeAnswer(question.slug, text, hints.length);
      setResult(graded);
      Haptics.notificationAsync(
        graded.verdict === 'good' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('server', String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function hint() {
    setBusy('hint');
    setError(null);
    try {
      const next = await askHint(question.slug, text, hints.length + 1);
      setHints([...hints, next]);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('server', String(e)));
    } finally {
      setBusy(null);
    }
  }

  if (result) return <GradeView label={label} question={question} result={result} onNext={() => onAnswer(result.outcome, meta)} c={c} />;

  return (
    <View style={styles.root}>
      <Prompt label={label} text={question.title} />

      {hints.map((h, i) => (
        <View key={i} style={[styles.hint, { backgroundColor: c.accentSoft }]}>
          <Ionicons name="bulb" size={16} color={c.accent} />
          <Text style={[styles.hintText, { color: c.text }]}>{h}</Text>
        </View>
      ))}

      <TextInput
        multiline
        value={text}
        onChangeText={setText}
        editable={!busy}
        placeholder={
          dictation.state === 'unavailable'
            ? 'Напиши ответ так, как сказал бы на собеседовании'
            : 'Нажми на микрофон и расскажи ответ — или напиши текстом'
        }
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text, backgroundColor: c.surface, borderColor: listening ? c.danger : c.border }]}
      />

      <View style={styles.row}>
        {dictation.state !== 'unavailable' && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={listening ? 'Остановить запись' : 'Начать запись'}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (listening) dictation.stop();
              else dictation.start();
            }}
            disabled={!!busy}
            style={({ pressed }) => [styles.mic, { backgroundColor: listening ? c.danger : c.accent, opacity: pressed ? 0.8 : 1 }]}
          >
            <Ionicons name={listening ? 'stop' : 'mic'} size={28} color="#FFFFFF" />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={!!busy || hints.length >= MAX_HINT_LEVEL}
          onPress={hint}
          style={({ pressed }) => [
            styles.hintButton,
            { borderColor: c.border, opacity: busy || hints.length >= MAX_HINT_LEVEL ? 0.4 : pressed ? 0.7 : 1 },
          ]}
        >
          {busy === 'hint' ? <ActivityIndicator color={c.accent} /> : <Ionicons name="bulb-outline" size={18} color={c.accent} />}
          <Text style={[styles.hintButtonText, { color: c.text }]}>Наводящий вопрос</Text>
        </Pressable>
      </View>
      <Text style={[styles.small, { color: c.textMuted }]}>
        {listening ? 'Слушаю… Говори спокойно, термины можно по-английски.' : 'Каждая подсказка снижает зачёт до «частично».'}
      </Text>

      {(dictation.error || error) && <Text style={[styles.error, { color: c.danger }]}>{dictation.error ?? error?.message}</Text>}

      {busy === 'grade' ? (
        <View style={styles.grading}>
          <ActivityIndicator color={c.accent} />
          <Text style={[styles.small, { color: c.textMuted }]}>Проверяю по рубрике…</Text>
        </View>
      ) : (
        <Button title="Проверить ответ" disabled={text.trim().length < MIN_ANSWER_CHARS || !!busy} onPress={grade} />
      )}
      {error && <Button title="Оценить себя самому" variant="secondary" onPress={onFallback} />}
    </View>
  );
}

const STATUS: Record<PointStatus, { icon: 'checkmark-circle' | 'ellipse-outline' | 'remove-circle-outline'; label: string }> = {
  covered: { icon: 'checkmark-circle', label: 'раскрыто' },
  partial: { icon: 'ellipse-outline', label: 'частично' },
  missing: { icon: 'remove-circle-outline', label: 'не прозвучало' },
};

const VERDICT = { good: 'Уверенный ответ', partial: 'Частично', weak: 'Пока слабо' };

function GradeView({
  label,
  question,
  result,
  onNext,
  c,
}: {
  label: string;
  question: Question;
  result: GradeResult;
  onNext: () => void;
  c: Colors;
}) {
  const [showReference, setShowReference] = useState(false);
  const tone = result.verdict === 'good' ? c.success : result.verdict === 'partial' ? c.warning : c.danger;
  const pointColor = (s: PointStatus) => (s === 'covered' ? c.success : s === 'partial' ? c.warning : c.textMuted);

  return (
    <View style={styles.root}>
      <Prompt label={label} text={question.title} />
      <View style={[styles.scoreBox, { borderColor: tone, backgroundColor: c.surface }]}>
        <Text style={[styles.score, { color: tone }]}>{result.score}</Text>
        <View style={styles.scoreText}>
          <Text style={[styles.verdict, { color: tone }]}>{VERDICT[result.verdict]}</Text>
          <Text style={[styles.small, { color: c.textMuted }]}>из 100 по рубрике</Text>
        </View>
      </View>

      <View style={styles.points}>
        {result.points.map((p) => (
          <View key={p.id} style={styles.point} accessibilityLabel={`${STATUS[p.status].label}: ${p.text}`}>
            <Ionicons name={STATUS[p.status].icon} size={18} color={pointColor(p.status)} style={styles.pointIcon} />
            <InlineText text={p.text} style={[styles.pointText, { color: p.status === 'missing' ? c.textMuted : c.text }]} />
          </View>
        ))}
      </View>

      {result.errors.length > 0 && (
        <View style={[styles.block, { backgroundColor: c.dangerSoft }]}>
          <Text style={[styles.blockTitle, { color: c.danger }]}>Ошибки</Text>
          {result.errors.map((e, i) => (
            <InlineText key={i} text={`• ${e}`} style={styles.blockText} />
          ))}
        </View>
      )}

      {result.feedback !== '' && <InlineText text={result.feedback} style={styles.feedback} />}

      {result.followUp !== '' && (
        <View style={[styles.block, { backgroundColor: c.surfaceAlt }]}>
          <Text style={[styles.blockTitle, { color: c.textMuted }]}>Интервьюер спросил бы дальше</Text>
          <InlineText text={result.followUp} style={styles.blockText} />
        </View>
      )}

      <Pressable accessibilityRole="button" onPress={() => setShowReference(!showReference)}>
        <Text style={[styles.link, { color: c.accent }]}>{showReference ? 'Скрыть эталон' : 'Показать эталон'}</Text>
      </Pressable>
      {showReference && <InlineText text={question.short} style={[styles.blockText, { color: c.textMuted }]} />}

      <Button title="Дальше" variant={result.verdict === 'weak' ? 'danger' : 'success'} onPress={onNext} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  input: { minHeight: 140, borderWidth: 2, borderRadius: 14, padding: 14, fontSize: 16, lineHeight: 22, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  hintButton: { flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  hintButtonText: { fontSize: 15, fontWeight: '600' },
  hint: { flexDirection: 'row', gap: 8, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  hintText: { flex: 1, fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13, lineHeight: 18 },
  error: { fontSize: 14, lineHeight: 20 },
  grading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 52 },
  scoreBox: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 2, borderRadius: 16, padding: 14 },
  score: { fontSize: 40, fontWeight: '800', fontFamily: MONO },
  scoreText: { gap: 2 },
  verdict: { fontSize: 18, fontWeight: '800' },
  points: { gap: 8 },
  point: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  pointIcon: { marginTop: 2 },
  pointText: { flex: 1, fontSize: 15, lineHeight: 21 },
  block: { borderRadius: 12, padding: 12, gap: 4 },
  blockTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  blockText: { fontSize: 15, lineHeight: 21 },
  feedback: { fontSize: 15, lineHeight: 22 },
  link: { fontSize: 15, fontWeight: '600' },
});
