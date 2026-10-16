import { TopicList } from '@/components/forum/TopicList';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import { questionBySlug } from '@/lib/content';
import { useAccount } from '@/lib/session';
import { useColors } from '@/lib/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/** Обсуждения одного вопроса — открывается из урока поверх него, урок не теряется */
export default function QuestionTopicsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const c = useColors();
  const account = useAccount();
  const question = questionBySlug.get(slug);
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <ScreenHeader title="Обсуждения вопроса" />
      <TopicList
        question={slug}
        header={<Text style={[styles.question, { color: c.text }]}>{question?.title ?? slug}</Text>}
      />
      <View style={[styles.fab, { bottom: insets.bottom + 12 }]}>
        <Button
          title={account.status === 'signed-in' ? 'Новая тема по вопросу' : 'Войти, чтобы писать'}
          onPress={() => router.push(account.status === 'signed-in' ? { pathname: '/forum/new', params: { question: slug } } : '/account')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  question: { fontSize: 20, fontWeight: '800', lineHeight: 26 },
  fab: { position: 'absolute', left: 16, right: 16, bottom: 12 },
});
