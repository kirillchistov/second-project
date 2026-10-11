import { CodeView } from '@/components/CodeView';
import { Button, OptionCard, Prompt } from '@/components/ui';
import { useColors } from '@/lib/theme';
import { useShuffledOrder } from '@/lib/useShuffled';
import { checkAnswer } from '@rr/core';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ExerciseProps } from './types';

/** «Найди баг»: тап по строке, затем выбор причины. */
export function FindBugExercise({ exercise, revealed, onSubmit }: ExerciseProps<'find-bug'>) {
  const c = useColors();
  const [line, setLine] = useState<number | null>(null);
  const [cause, setCause] = useState<number | null>(null);
  const order = useShuffledOrder(exercise.causes.length);

  const marked = useMemo(() => {
    if (!revealed) return undefined;
    const map = new Map<number, 'correct' | 'wrong'>(exercise.bugLines.map((n) => [n, 'correct']));
    if (line !== null && !exercise.bugLines.includes(line)) map.set(line, 'wrong');
    return map;
  }, [revealed, line, exercise.bugLines]);

  return (
    <View style={styles.root}>
      <Prompt label="Найди баг" text={exercise.prompt} />
      <CodeView
        code={exercise.code}
        language={exercise.language}
        selectedLine={line ?? undefined}
        markedLines={marked}
        onLinePress={revealed ? undefined : setLine}
      />
      {line === null ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>Тапни строку с ошибкой</Text>
      ) : (
        <View style={styles.options}>
          <Text style={[styles.step, { color: c.textMuted }]}>Строка {line}. Почему это ошибка?</Text>
          {order.map((i) => (
            <OptionCard
              key={i}
              selected={cause === i}
              state={revealed ? (i === exercise.answer ? 'correct' : i === cause ? 'wrong' : undefined) : undefined}
              disabled={revealed}
              onPress={() => setCause(i)}
            >
              {exercise.causes[i]}
            </OptionCard>
          ))}
        </View>
      )}
      {!revealed && (
        <Button
          title="Проверить"
          disabled={line === null || cause === null}
          onPress={() => line !== null && cause !== null && onSubmit(checkAnswer(exercise, { kind: 'bug', line, cause }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  options: { gap: 10 },
  hint: { fontSize: 15, textAlign: 'center' },
  step: { fontSize: 14, fontWeight: '600' },
});
