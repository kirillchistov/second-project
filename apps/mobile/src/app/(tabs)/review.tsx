import { Button } from '@/components/ui';
import { ITEMS } from '@/lib/content';
import { fibiFace } from '@/lib/fibi';
import { useNow } from '@/lib/now';
import { useProgress } from '@/lib/progress';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dueCount } from '@rr/core';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function itemTitle(id: string): string {
  const item = ITEMS.get(id);
  if (!item) return id;
  return item.kind === 'card' ? item.question.title : item.exercise.prompt;
}

export default function ReviewScreen() {
  const c = useColors();
  const { cards, backlog } = useProgress();
  const due = dueCount(cards, useNow());
  const total = backlog.length + due;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: c.text }]}>Повторение</Text>

        <View style={styles.cards}>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="bug" size={22} color={c.danger} />
            <Text style={[styles.cardValue, { color: c.text }]}>{backlog.length}</Text>
            <Text style={[styles.cardLabel, { color: c.textMuted }]}>в Bug Backlog</Text>
          </View>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Ionicons name="time" size={22} color={c.accent} />
            <Text style={[styles.cardValue, { color: c.text }]}>{due}</Text>
            <Text style={[styles.cardLabel, { color: c.textMuted }]}>навыков пора освежить</Text>
          </View>
        </View>

        <Text style={[styles.text, { color: c.textMuted }]}>
          Ошибки не сжигают жизни — они попадают в backlog и закрываются, когда ты решишь задание с первой попытки.
          Навыки возвращаются по кривой забывания: чуть раньше, чем ты бы их забыл.
        </Text>

        {total > 0 ? (
          <Button title={`Повторить (${Math.min(total, 10)})`} onPress={() => router.push('/lesson/review')} />
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.face, { color: c.text }]}>{fibiFace('proud')}</Text>
            <Text style={[styles.text, { color: c.textMuted, textAlign: 'center' }]}>Всё свежо. Загляни завтра или пройди новый урок.</Text>
          </View>
        )}

        {backlog.length > 0 && (
          <View style={styles.list}>
            <Text style={[styles.subtitle, { color: c.text }]}>Bug Backlog</Text>
            {backlog.map((id) => (
              <View key={id} style={[styles.row, { borderColor: c.border }]}>
                <Ionicons name="ellipse" size={8} color={c.danger} />
                <Text numberOfLines={2} style={[styles.rowText, { color: c.text }]}>
                  {itemTitle(id)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: '800' },
  cards: { flexDirection: 'row', gap: 12 },
  card: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 14, gap: 4 },
  cardValue: { fontSize: 28, fontWeight: '800' },
  cardLabel: { fontSize: 13 },
  text: { fontSize: 15, lineHeight: 21 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  face: { fontSize: 36 },
  list: { gap: 8 },
  subtitle: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  rowText: { flex: 1, fontSize: 15 },
});
