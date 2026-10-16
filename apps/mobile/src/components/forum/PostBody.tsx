import { InlineText } from '@/components/ui';
import { MONO, useColors } from '@/lib/theme';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

/**
 * Текст сообщения форума: абзацы, блоки кода в ``` и инлайн-разметка (`код`, **жирный**, ссылки).
 * Всё рисуется компонентами Text — HTML не интерпретируется, поэтому вставить скрипт или разметку нельзя.
 */
export function PostBody({ text }: { text: string }) {
  const c = useColors();
  const blocks: { code: boolean; text: string }[] = [];
  let inCode = false;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) blocks.push({ code: inCode, text: buffer.join('\n') });
    buffer = [];
  };
  for (const line of text.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      flush();
      inCode = !inCode;
      continue;
    }
    if (!inCode && line.trim() === '') {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return (
    <View style={styles.root}>
      {blocks.map((b, i) =>
        b.code ? (
          <ScrollView key={i} horizontal style={[styles.code, { backgroundColor: c.codeBg, borderColor: c.border }]}>
            <Text style={[styles.codeText, { color: c.text }]}>{b.text}</Text>
          </ScrollView>
        ) : (
          <InlineText key={i} text={b.text} style={styles.paragraph} />
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  paragraph: { fontSize: 15, lineHeight: 21 },
  code: { borderWidth: 1, borderRadius: 10, padding: 10 },
  codeText: { fontFamily: MONO, fontSize: 13, lineHeight: 19 },
});
