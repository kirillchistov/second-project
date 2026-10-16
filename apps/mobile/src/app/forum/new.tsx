import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import { questionBySlug } from '@/lib/content';
import { createTopic } from '@/lib/forum';
import { forumErrorMessage } from '@/lib/forumErrors';
import { useColors } from '@/lib/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Новая тема; ?question=slug — тема по вопросу банка */
export default function NewTopicScreen() {
  const { question } = useLocalSearchParams<{ question?: string }>();
  const c = useColors();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linked = question ? questionBySlug.get(question) : undefined;
  const ready = title.trim().length >= 5 && body.trim().length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const id = await createTopic({ title, body, questionSlug: linked ? question : null });
      router.replace(`/forum/${id}`);
    } catch (e) {
      setError(forumErrorMessage(e));
      setBusy(false);
    }
  }

  const input = [styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }];
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title="Новая тема" />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {linked && (
            <View style={[styles.linked, { backgroundColor: c.accentSoft }]}>
              <Text style={[styles.label, { color: c.accent }]}>Вопрос</Text>
              <Text style={[styles.linkedTitle, { color: c.text }]}>{linked.title}</Text>
            </View>
          )}
          <Text style={[styles.label, { color: c.textMuted }]}>Заголовок</Text>
          <TextInput
            accessibilityLabel="Заголовок"
            value={title}
            onChangeText={setTitle}
            maxLength={120}
            placeholder="Например: почему index в key ломает состояние?"
            placeholderTextColor={c.textMuted}
            style={input}
          />
          <Text style={[styles.label, { color: c.textMuted }]}>Сообщение</Text>
          <TextInput
            accessibilityLabel="Сообщение"
            value={body}
            onChangeText={setBody}
            maxLength={5000}
            multiline
            textAlignVertical="top"
            placeholder="Опиши, что непонятно. Код — в обратных кавычках: `useEffect` или блоком ```"
            placeholderTextColor={c.textMuted}
            style={[input, styles.body]}
          />
          {error && (
            <Text accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
              {error}
            </Text>
          )}
          {busy ? <ActivityIndicator color={c.accent} /> : <Button title="Опубликовать" onPress={submit} disabled={!ready} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 10 },
  linked: { borderRadius: 12, padding: 12, gap: 2 },
  linkedTitle: { fontSize: 15, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  body: { minHeight: 160 },
  error: { fontSize: 14, fontWeight: '600' },
});
