import { Button, InlineText, OptionCard, Prompt } from '@/components/ui';
import { topicTitle } from '@/lib/content';
import { useCardMode } from '@/lib/preferences';
import { useColors } from '@/lib/theme';
import { useShuffledOrder } from '@/lib/useShuffled';
import type { Question } from '@rr/content';
import { checkAnswer, type AnswerMeta, type Outcome, type QuizExercise } from '@rr/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { VoiceExercise } from './VoiceExercise';

type Mode = 'choose' | 'voice' | 'explain' | 'quiz';

/**
 * Карточка вопроса. Три способа ответить:
 * - голосом: рассказать ответ, ИИ разберёт его по рубрике;
 * - про себя: вспомнить, открыть эталон и честно оценить себя;
 * - с вариантами: выбрать верную формулировку, если для вопроса есть quiz.
 * Все способы двигают интервальное повторение одного и того же навыка.
 */
export function CardExercise({
  question,
  quiz,
  revealed,
  onAnswer,
}: {
  question: Question;
  quiz?: QuizExercise;
  revealed: boolean;
  /** `feedback` — показать панель разбора (для варианта с выбором), иначе урок идёт дальше сразу */
  onAnswer: (outcome: Outcome, feedback: boolean, meta: AnswerMeta) => void;
}) {
  const preferred = useCardMode();
  const [mode, setMode] = useState<Mode>(() => {
    if (preferred === 'quiz') return quiz ? 'quiz' : 'choose';
    return preferred === 'ask' ? 'choose' : preferred;
  });
  const label = `Вопрос · ${topicTitle.get(question.topic) ?? ''}`;

  if (mode === 'quiz' && quiz) {
    return <QuizMode quiz={quiz} label={label} revealed={revealed} onAnswer={(o) => onAnswer(o, true, { mode: 'quiz', hints: 0 })} />;
  }
  if (mode === 'voice') {
    return (
      <VoiceExercise
        question={question}
        label={label}
        onAnswer={(o, meta) => onAnswer(o, false, meta)}
        onFallback={() => setMode('explain')}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Prompt label={label} text={question.title} />
      {mode === 'choose' ? (
        <ChooseMode hasQuiz={!!quiz} onPick={setMode} />
      ) : (
        <ExplainMode question={question} onGrade={(outcome) => onAnswer(outcome, false, { mode: 'explain', hints: 0 })} />
      )}
    </View>
  );
}

function ChooseMode({ hasQuiz, onPick }: { hasQuiz: boolean; onPick: (mode: Mode) => void }) {
  const c = useColors();
  return (
    <View style={styles.choose}>
      <Text style={[styles.hint, { color: c.textMuted }]}>Как ответишь?</Text>
      <Button title="Рассказать — ИИ проверит" onPress={() => onPick('voice')} />
      <Button title="Про себя, потом сверить" variant="secondary" onPress={() => onPick('explain')} />
      {hasQuiz && <Button title="Выбрать из вариантов" variant="secondary" onPress={() => onPick('quiz')} />}
      <Text style={[styles.small, { color: c.textMuted }]}>
        Рассказать вслух — лучшая тренировка памяти и собеседования. Режим по умолчанию меняется в профиле.
      </Text>
    </View>
  );
}

function ExplainMode({ question, onGrade }: { question: Question; onGrade: (outcome: Outcome) => void }) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <>
        <View style={[styles.think, { backgroundColor: c.surfaceAlt }]}>
          <Text style={[styles.thinkText, { color: c.textMuted }]}>
            Сформулируй ответ сам — вслух или про себя. Ключевые слова, пример, подводный камень. Потом сверься.
          </Text>
        </View>
        <Button title="Показать эталон" onPress={() => setOpen(true)} />
      </>
    );
  }

  return (
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
      <Text style={[styles.hint, { color: c.textMuted }]}>Насколько твой ответ совпал с эталоном?</Text>
      <View style={styles.grades}>
        <Button title="Не вспомнил" variant="danger" onPress={() => onGrade('again')} style={styles.grade} />
        <Button title="Частично" variant="secondary" onPress={() => onGrade('hard')} style={styles.grade} />
        <Button title="Знаю" variant="success" onPress={() => onGrade('good')} style={styles.grade} />
      </View>
    </>
  );
}

function QuizMode({
  quiz,
  label,
  revealed,
  onAnswer,
}: {
  quiz: QuizExercise;
  label: string;
  revealed: boolean;
  onAnswer: (outcome: Outcome, feedback: boolean) => void;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<number | null>(null);
  const order = useShuffledOrder(quiz.options.length);

  return (
    <View style={styles.root}>
      <Prompt label={label} text={quiz.prompt} />
      <View style={styles.options}>
        {order.map((i) => (
          <OptionCard
            key={i}
            selected={selected === i}
            state={revealed ? (i === quiz.answer ? 'correct' : i === selected ? 'wrong' : undefined) : undefined}
            disabled={revealed}
            onPress={() => setSelected(i)}
          >
            <View style={styles.option}>
              <InlineText text={quiz.options[i].label} style={styles.optionText} />
              {revealed && <Text style={[styles.why, { color: c.textMuted }]}>{quiz.options[i].why}</Text>}
            </View>
          </OptionCard>
        ))}
      </View>
      {!revealed && (
        <Button
          title="Проверить"
          disabled={selected === null}
          onPress={() => selected !== null && onAnswer(checkAnswer(quiz, { kind: 'choice', index: selected }) ? 'good' : 'again', true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  choose: { gap: 10 },
  hint: { fontSize: 14, textAlign: 'center' },
  small: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  think: { borderRadius: 14, padding: 16 },
  thinkText: { fontSize: 15, lineHeight: 22 },
  answer: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  answerText: { fontSize: 16, lineHeight: 24 },
  pitfalls: { gap: 4 },
  pitfallsTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pitfall: { fontSize: 14, lineHeight: 20 },
  grades: { flexDirection: 'row', gap: 8 },
  grade: { flex: 1, paddingHorizontal: 6 },
  options: { gap: 10 },
  option: { gap: 6 },
  optionText: { fontSize: 16, lineHeight: 22 },
  why: { fontSize: 14, lineHeight: 20 },
});
