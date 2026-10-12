import { Button, OptionCard, Prompt } from '@/components/ui';
import { useCodeFont } from '@/lib/codeFont';
import { MONO, useColors } from '@/lib/theme';
import { CODE_FONT, checkAnswer, shuffle } from '@rr/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ExerciseProps } from './types';

type Piece = { id: number; text: string };

function shuffledPieces(items: string[], correct: string[]): Piece[] {
  const pieces = items.map((text, id) => ({ id, text }));
  // Перемешиваем, пока порядок не перестанет совпадать с ответом — иначе задание решается само
  for (let i = 0; i < 10; i++) {
    const result = shuffle(pieces);
    if (result.slice(0, correct.length).some((p, j) => p.text !== correct[j])) return result;
  }
  return [...pieces].reverse();
}

/**
 * «Порядок» (таймлайн, рецепт) и «Пазл Парсонса»: собрать последовательность тапами.
 * Тап по фишке внизу добавляет её в ответ, тап по шагу ответа — возвращает обратно.
 */
export function ArrangeExercise({ exercise, revealed, onSubmit }: ExerciseProps<'order' | 'parsons'>) {
  const c = useColors();
  const isCode = exercise.type === 'parsons';
  // Строки Parsons переносятся внутри карточек, вписывать их не нужно — берём только ручной кегль
  const font = useCodeFont();
  const mono = [styles.mono, { fontSize: font.mode === 'manual' ? font.size : CODE_FONT.default }];
  const correct = isCode ? exercise.lines : exercise.steps;
  const [pool] = useState(() => shuffledPieces(isCode ? [...exercise.lines, ...exercise.distractors] : exercise.steps, correct));
  const [answer, setAnswer] = useState<number[]>([]);

  const byId = new Map(pool.map((p) => [p.id, p]));
  const label = isCode ? 'Собери код' : exercise.kind === 'timeline' ? 'Расставь по порядку' : 'Собери алгоритм';
  const display = (text: string) => (isCode ? text.replace(/^ +/, (s) => ' '.repeat(s.length)) : text);

  return (
    <View style={styles.root}>
      <Prompt label={label} text={exercise.prompt} />

      <View style={[styles.answer, { borderColor: c.border }]}>
        {answer.length === 0 && <Text style={[styles.placeholder, { color: c.textMuted }]}>Тапай фишки ниже по порядку</Text>}
        {answer.map((id, i) => {
          const piece = byId.get(id)!;
          const state = revealed ? (piece.text === correct[i] ? 'correct' : 'wrong') : undefined;
          return (
            <OptionCard key={id} state={state} disabled={revealed} onPress={() => setAnswer(answer.filter((a) => a !== id))}>
              <View style={styles.row}>
                {!isCode && <Text style={[styles.index, { color: c.textMuted }]}>{i + 1}</Text>}
                <Text style={[styles.text, { color: c.text }, isCode && mono]}>{display(piece.text)}</Text>
              </View>
            </OptionCard>
          );
        })}
      </View>

      {!revealed && (
        <View style={styles.pool}>
          {pool
            .filter((p) => !answer.includes(p.id))
            .map((p) => (
              <OptionCard key={p.id} onPress={() => setAnswer([...answer, p.id])}>
                <Text style={[styles.text, { color: c.text }, isCode && mono]}>{display(p.text)}</Text>
              </OptionCard>
            ))}
        </View>
      )}

      {!revealed && (
        <Button
          title="Проверить"
          disabled={answer.length !== correct.length}
          onPress={() => onSubmit(checkAnswer(exercise, { kind: 'sequence', items: answer.map((id) => byId.get(id)!.text) }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  answer: { minHeight: 80, borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, padding: 8, gap: 6 },
  placeholder: { textAlign: 'center', paddingVertical: 24, fontSize: 15 },
  pool: { gap: 8 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  index: { fontWeight: '700', fontSize: 15, minWidth: 16 },
  text: { fontSize: 15, lineHeight: 21, flexShrink: 1 },
  mono: { fontFamily: MONO, fontSize: 13 },
});
