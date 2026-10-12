import { fitCodeFont, stepCodeFontFrom } from '@/lib/codeFont';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CODE_FONT, type CodeFontMode } from '@rr/core';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Кнопки над блоком кода: мельче, крупнее, вписать по ширине. Настройка общая для всех блоков. */
export function CodeToolbar({ size, mode }: { size: number; mode: CodeFontMode }) {
  const c = useColors();
  const button = (label: string, onPress: () => void, content: ReactNode, opts: { active?: boolean; disabled?: boolean } = {}) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: opts.active, disabled: opts.disabled }}
      disabled={opts.disabled}
      hitSlop={6}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: opts.active ? c.accent : c.border,
          backgroundColor: opts.active ? c.accentSoft : c.surface,
          opacity: opts.disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      {content}
    </Pressable>
  );

  return (
    <View style={styles.row}>
      <Text style={[styles.size, { color: c.textMuted }]}>{Math.round(size)} pt</Text>
      {button('Уменьшить шрифт кода', () => stepCodeFontFrom(size, -1), <Text style={[styles.label, { color: c.text }]}>A−</Text>, {
        disabled: size <= CODE_FONT.min,
      })}
      {button('Увеличить шрифт кода', () => stepCodeFontFrom(size, 1), <Text style={[styles.label, { color: c.text }]}>A+</Text>, {
        disabled: size >= CODE_FONT.max,
      })}
      {button('Вписать код по ширине', fitCodeFont, <Ionicons name="scan-outline" size={16} color={mode === 'fit' ? c.accent : c.text} />, {
        active: mode === 'fit',
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  size: { fontSize: 12, marginRight: 4, fontVariant: ['tabular-nums'] },
  button: { minWidth: 40, height: 32, borderWidth: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: { fontSize: 14, fontWeight: '700' },
});
