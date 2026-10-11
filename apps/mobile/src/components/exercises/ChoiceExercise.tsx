import { CodeView } from '@/components/CodeView';
import { Button, InlineText, OptionCard, Prompt } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useShuffledOrder } from '@/lib/useShuffled';
import { checkAnswer } from '@rr/core';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ExerciseProps } from './types';

/** «Предскажи вывод» и «Выбери инструмент»: выбрать один вариант. */
export function ChoiceExercise({ exercise, revealed, onSubmit }: ExerciseProps<'predict-output' | 'choose-tool'>) {
  const c = useColors();
  const [selected, setSelected] = useState<number | null>(null);
  const isTool = exercise.type === 'choose-tool';
  const order = useShuffledOrder(exercise.options.length);

  return (
    <View style={styles.root}>
      <Prompt label={isTool ? 'Выбери инструмент' : 'Предскажи вывод'} text={exercise.prompt} />
      {exercise.type === 'predict-output' && <CodeView code={exercise.code} language={exercise.language} />}
      <View style={styles.options}>
        {order.map((i) => {
          const option = exercise.options[i];
          const label = typeof option === 'string' ? option : option.label;
          const state = revealed ? (i === exercise.answer ? 'correct' : i === selected ? 'wrong' : undefined) : undefined;
          return (
            <OptionCard key={i} selected={selected === i} state={state} disabled={revealed} onPress={() => setSelected(i)} mono={!isTool}>
              <View style={styles.optionBody}>
                <InlineText text={label} style={[styles.optionText, !isTool && styles.optionMono]} />
                {/* После проверки «Выбери инструмент» объясняет каждый вариант — так запоминается граница применимости */}
                {revealed && typeof option !== 'string' && <Text style={[styles.why, { color: c.textMuted }]}>{option.why}</Text>}
              </View>
            </OptionCard>
          );
        })}
      </View>
      {!revealed && (
        <Button
          title="Проверить"
          disabled={selected === null}
          onPress={() => selected !== null && onSubmit(checkAnswer(exercise, { kind: 'choice', index: selected }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  options: { gap: 10 },
  optionBody: { gap: 6 },
  optionText: { fontSize: 16, lineHeight: 22 },
  optionMono: { fontSize: 14 },
  why: { fontSize: 14, lineHeight: 20 },
});
