import { TopicList } from '@/components/forum/TopicList';
import { Button } from '@/components/ui';
import { useAccount } from '@/lib/session';
import { useColors } from '@/lib/theme';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Форум игроков: все темы, свежие обсуждения сверху */
export default function ForumScreen() {
  const c = useColors();
  const account = useAccount();
  const signedIn = account.status === 'signed-in';
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <TopicList
        header={
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>Форум</Text>
            <Text style={[styles.lead, { color: c.textMuted }]}>
              Спроси, если ответ в уроке не убедил, или помоги другим. Темы по вопросу открываются и из урока.
            </Text>
          </View>
        }
      />
      <View style={styles.fab}>
        <Button
          title={signedIn ? 'Новая тема' : 'Войти, чтобы писать'}
          onPress={() => router.push(signedIn ? '/forum/new' : '/account')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: 6 },
  title: { fontSize: 28, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 21 },
  fab: { position: 'absolute', left: 16, right: 16, bottom: 12 },
});
