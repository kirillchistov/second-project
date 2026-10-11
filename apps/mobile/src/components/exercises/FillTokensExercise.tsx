import { Button, Prompt } from '@/components/ui';
import { MONO, useColors } from '@/lib/theme';
import { GAP } from '@rr/content';
import { checkAnswer, shuffle } from '@rr/core';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ExerciseProps } from './types';

/** «Токен-пропуски»: тап по фишке заполняет ближайший пустой пропуск, тап по пропуску — очищает его. */
export function FillTokensExercise({ exercise, revealed, onSubmit }: ExerciseProps<'fill-tokens'>) {
  const c = useColors();
  const parts = exercise.code.trimEnd().split(GAP);
  const [chips] = useState(() => shuffle([...exercise.tokens, ...exercise.decoys]).map((text, id) => ({ id, text })));
  // для каждого пропуска — id фишки или null
  const [filled, setFilled] = useState<(number | null)[]>(() => exercise.tokens.map(() => null));

  const used = new Set(filled.filter((id): id is number => id !== null));
  const answer = filled.map((id) => (id === null ? '' : chips[id].text));

  const put = (chipId: number) => {
    const gap = filled.indexOf(null);
    if (gap === -1) return;
    Haptics.selectionAsync();
    setFilled(filled.map((v, i) => (i === gap ? chipId : v)));
  };
  const clear = (gap: number) => setFilled(filled.map((v, i) => (i === gap ? null : v)));

  return (
    <View style={styles.root}>
      <Prompt label="Заполни пропуски" text={exercise.prompt} />
      <View style={[styles.codeBox, { backgroundColor: c.codeBg, borderColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Text style={[styles.code, { color: c.text }]}>
            {parts.map((part, i) => (
              <Text key={i}>
                {part}
                {i < parts.length - 1 && (
                  <Text
                    onPress={revealed ? undefined : () => clear(i)}
                    style={[
                      styles.gap,
                      {
                        color: revealed ? (answer[i] === exercise.tokens[i] ? c.success : c.danger) : c.accent,
                        backgroundColor: revealed ? (answer[i] === exercise.tokens[i] ? c.successSoft : c.dangerSoft) : c.accentSoft,
                      },
                    ]}
                  >
                    {answer[i] ? ` ${answer[i]} ` : ' ____ '}
                  </Text>
                )}
              </Text>
            ))}
          </Text>
        </ScrollView>
      </View>
      {!revealed && (
        <View style={styles.keyboard}>
          {chips.map((chip) => (
            <Pressable
              key={chip.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: used.has(chip.id) }}
              disabled={used.has(chip.id)}
              onPress={() => put(chip.id)}
              style={({ pressed }) => [
                styles.chip,
                { borderColor: c.border, backgroundColor: c.surface, opacity: used.has(chip.id) ? 0.25 : pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.chipText, { color: c.text }]}>{chip.text}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {!revealed && (
        <Button
          title="Проверить"
          disabled={filled.includes(null)}
          onPress={() => onSubmit(checkAnswer(exercise, { kind: 'tokens', tokens: answer }))}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 16 },
  codeBox: { borderWidth: 1, borderRadius: 12, padding: 12 },
  code: { fontFamily: MONO, fontSize: 13, lineHeight: 24 },
  gap: { fontFamily: MONO, fontWeight: '700' },
  keyboard: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { borderWidth: 2, borderBottomWidth: 4, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14 },
  chipText: { fontFamily: MONO, fontSize: 15, fontWeight: '600' },
});
