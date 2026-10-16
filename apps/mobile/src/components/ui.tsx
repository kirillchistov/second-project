import { inlineSegments } from '@/lib/markdown';
import { MONO, useColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const bg = { primary: c.accent, secondary: c.surfaceAlt, success: c.success, danger: c.danger }[variant];
  const fg = variant === 'secondary' ? c.text : '#FFFFFF';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: disabled ? c.surfaceAlt : bg, opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: disabled ? c.textMuted : fg }]}>{title}</Text>
    </Pressable>
  );
}

/** Вариант ответа или фишка: выбирается тапом, умеет подсвечивать правильность после проверки. */
export function OptionCard({
  children,
  selected,
  state,
  onPress,
  disabled,
  mono,
}: {
  children: ReactNode;
  selected?: boolean;
  state?: 'correct' | 'wrong';
  onPress?: () => void;
  disabled?: boolean;
  mono?: boolean;
}) {
  const c = useColors();
  const border = state === 'correct' ? c.success : state === 'wrong' ? c.danger : selected ? c.accent : c.border;
  const bg = state === 'correct' ? c.successSoft : state === 'wrong' ? c.dangerSoft : selected ? c.accentSoft : c.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => {
        Haptics.selectionAsync();
        onPress?.();
      }}
      style={({ pressed }) => [styles.option, { borderColor: border, backgroundColor: bg, opacity: pressed ? 0.8 : 1 }]}
    >
      {typeof children === 'string' ? (
        // Моноширинный вариант — код как есть; обычный текст может содержать `код` и **акценты**
        mono ? (
          <Text style={[styles.optionText, { color: c.text }, styles.mono]}>{children}</Text>
        ) : (
          <InlineText text={children} style={[styles.optionText, { color: c.text }]} />
        )
      ) : (
        children
      )}
    </Pressable>
  );
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  const c = useColors();
  return (
    <View style={[styles.track, { backgroundColor: c.surfaceAlt }]}>
      <View style={[styles.fill, { width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`, backgroundColor: color ?? c.success }]} />
    </View>
  );
}

/** Текст с инлайн-разметкой Markdown: `код`, **жирный**, *курсив*, [ссылка](…). */
export function InlineText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const c = useColors();
  return (
    <Text style={[{ color: c.text }, style]}>
      {inlineSegments(text).map((seg, i) => (
        <Text
          key={i}
          style={
            seg.style === 'code'
              ? [styles.mono, { backgroundColor: c.surfaceAlt, fontSize: 14 }]
              : seg.style === 'bold'
                ? { fontWeight: '700' }
                : seg.style === 'italic'
                  ? { fontStyle: 'italic' }
                  : seg.style === 'link'
                    ? { color: c.accent }
                    : undefined
          }
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

export function Prompt({ text, label }: { text: string; label: string }) {
  const c = useColors();
  return (
    <View style={styles.prompt}>
      <Text style={[styles.label, { color: c.accent }]}>{label}</Text>
      <InlineText text={text} style={styles.promptText} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  buttonText: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  option: { borderWidth: 2, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 16 },
  optionText: { fontSize: 16, lineHeight: 22 },
  mono: { fontFamily: MONO, fontSize: 13 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 6 },
  prompt: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  promptText: { fontSize: 20, lineHeight: 27, fontWeight: '600' },
});
