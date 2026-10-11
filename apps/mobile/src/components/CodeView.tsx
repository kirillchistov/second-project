import { MONO, useColors } from '@/lib/theme';
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

  return (
    <View style={[styles.box, { backgroundColor: c.codeBg, borderColor: c.border }]}>
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
                  <View style={[styles.line, { backgroundColor: bg }]}>
                    <Text style={[styles.number, { color: c.textMuted }]}>{n}</Text>
                    <Text style={styles.code}>
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
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  scroll: { paddingVertical: 10 },
  line: { flexDirection: 'row', paddingRight: 14, minHeight: 22, alignItems: 'center' },
  number: { width: 32, textAlign: 'right', paddingRight: 10, fontFamily: MONO, fontSize: 12 },
  code: { fontFamily: MONO, fontSize: 13, lineHeight: 20 },
});
