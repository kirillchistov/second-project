import { Button, InlineText, Prompt } from '@/components/ui';
import { topicTitle } from '@/lib/content';
import { useColors } from '@/lib/theme';
import type { Question } from '@rr/content';
import type { Outcome } from '@rr/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Карточка вопроса: сначала вспомнить самому, потом открыть эталон и честно оценить себя.
 * Самооценка двигает интервальное повторение так же, как результат упражнения.
 */
export function CardExercise({ question, onGrade }: { question: Question; onGrade: (outcome: Outcome) => void }) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.root}>
      <Prompt label={`Вопрос · ${topicTitle.get(question.topic) ?? ''}`} text={question.title} />
      {!open ? (
        <>
          <View style={[styles.think, { backgroundColor: c.surfaceAlt }]}>
            <Text style={[styles.thinkText, { color: c.textMuted }]}>
              Сформулируй ответ сам — вслух или про себя. Ключевые слова, пример, подводный камень. Потом сверься.
            </Text>
          </View>
          <Button title="Показать эталон" onPress={() => setOpen(true)} />
        </>
      ) : (
        <>
          <View style={[styles.answer, { backgroundColor: c.surface, borderColor: c.border }]}>
            <InlineText text={question.short} style={styles.answerText} />
            {question.pitfalls.length > 0 && (
              <View style={styles.pitfalls}>
                <Text style={[styles.pitfallsTitle, { color: c.warning }]}>Подводные камни</Text>
                {question.pitfalls.slice(0, 2).map((p, i) => (
                  <InlineText key={i} text={`• ${p}`} style={[styles.pitfall, { color: c.textMuted }]} />
                ))}
              </View>
            )}
          </View>
          <Text style={[styles.gradeTitle, { color: c.textMuted }]}>Насколько твой ответ совпал с эталоном?</Text>
          <View style={styles.grades}>
            <Button title="Не вспомнил" variant="danger" onPress={() => onGrade('again')} style={styles.grade} />
            <Button title="Частично" variant="secondary" onPress={() => onGrade('hard')} style={styles.grade} />
            <Button title="Знаю" variant="success" onPress={() => onGrade('good')} style={styles.grade} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  think: { borderRadius: 14, padding: 16 },
  thinkText: { fontSize: 15, lineHeight: 22 },
  answer: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  answerText: { fontSize: 16, lineHeight: 24 },
  pitfalls: { gap: 4 },
  pitfallsTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pitfall: { fontSize: 14, lineHeight: 20 },
  gradeTitle: { fontSize: 14, textAlign: 'center' },
  grades: { flexDirection: 'row', gap: 8 },
  grade: { flex: 1, paddingHorizontal: 6 },
});
