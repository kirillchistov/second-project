import { CodeToolbar } from '@/components/CodeToolbar';
import { useCodeFontSize } from '@/lib/codeFont';
import { MONO, useColors } from '@/lib/theme';
import { longestLine } from '@rr/core';
import * as Haptics from 'expo-haptics';
import { Highlight, themes } from 'prism-react-renderer';
import { Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';

/**
 * Код с подсветкой. Строки можно тапать (упражнение «Найди баг»).
 * Длинные строки прокручиваются по горизонтали, а не переносятся — переносы ломают чтение кода.
 */
export function CodeView({
  code,
  language = 'tsx',
  onLinePress,
  selectedLine,
  markedLines,
}: {
  code: string;
  language?: string;
  onLinePress?: (line: number) => void;
  selectedLine?: number;
  /** Подсветка после проверки: номер строки → верно/неверно */
  markedLines?: Map<number, 'correct' | 'wrong'>;
}) {
  const c = useColors();
  const theme = useColorScheme() === 'dark' ? themes.vsDark : themes.github;
  // Колонка номеров — 2 em + отступ 10; справа отступ 14 и рамка 2
  const { size, mode, onLayout } = useCodeFontSize(longestLine(code.trimEnd()), { em: 2, px: 26 });
  const numberWidth = size * 2 + 10;
  const lineHeight = Math.round(size * 1.55);

  return (
    <View style={styles.wrap}>
      <CodeToolbar size={size} mode={mode} />
      <View onLayout={onLayout} style={[styles.box, { backgroundColor: c.codeBg, borderColor: c.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <Highlight code={code.trimEnd()} language={language} theme={theme}>
            {({ tokens, getTokenProps }) => (
              <View>
                {tokens.map((line, i) => {
                  const n = i + 1;
                  const mark = markedLines?.get(n);
                  const bg =
                    mark === 'correct' ? c.successSoft : mark === 'wrong' ? c.dangerSoft : selectedLine === n ? c.accentSoft : 'transparent';
                  const content = (
                    <View style={[styles.line, { backgroundColor: bg, minHeight: lineHeight + 2 }]}>
                      <Text style={[styles.number, { color: c.textMuted, width: numberWidth, fontSize: size * 0.9 }]}>{n}</Text>
                      <Text style={[styles.code, { fontSize: size, lineHeight }]}>
                        {line.map((token, key) => {
                          const { style } = getTokenProps({ token });
                          return (
                            <Text key={key} style={{ color: style?.color ?? c.text, fontStyle: style?.fontStyle === 'italic' ? 'italic' : 'normal' }}>
                              {token.content}
                            </Text>
                          );
                        })}
                      </Text>
                    </View>
                  );
                  return onLinePress ? (
                    <Pressable
                      key={i}
                      accessibilityRole="button"
                      accessibilityLabel={`Строка ${n}`}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onLinePress(n);
                      }}
                    >
                      {content}
                    </Pressable>
                  ) : (
                    <View key={i}>{content}</View>
                  );
                })}
              </View>
            )}
          </Highlight>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  box: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  scroll: { paddingVertical: 10 },
  line: { flexDirection: 'row', paddingRight: 14, alignItems: 'center' },
  number: { textAlign: 'right', paddingRight: 10, fontFamily: MONO },
  code: { fontFamily: MONO },
});
