import { listTopics, relativeTime, type TopicSummary } from '@/lib/forum';
import { questionBySlug } from '@/lib/content';
import { useNow } from '@/lib/now';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

/** Список тем форума: свежие обсуждения сверху, подгрузка следующих страниц при прокрутке. */
export function TopicList({ question, header }: { question?: string; header: ReactElement }) {
  const c = useColors();
  const now = useNow();
  const [topics, setTopics] = useState<TopicSummary[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await listTopics({ question });
      setTopics(res.topics);
      setNext(res.next);
      setError(null);
    } catch {
      setError('Не удалось загрузить форум. Проверь связь с сервером.');
    }
  }, [question]);

  // Перечитываем при возвращении на экран: могли появиться новые темы и ответы
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function loadMore() {
    if (!next || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listTopics({ question, cursor: next });
      setTopics((list) => [...(list ?? []), ...res.topics]);
      setNext(res.next);
    } catch {
      // следующая страница подгрузится при следующей прокрутке
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <FlatList
      data={topics ?? []}
      keyExtractor={(t) => t.id}
      contentContainerStyle={styles.list}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {error && <Text style={[styles.meta, { color: c.danger }]}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={
        topics === null && !error ? (
          <ActivityIndicator color={c.accent} />
        ) : (
          <Text style={[styles.empty, { color: c.textMuted }]}>Тем пока нет. Начни обсуждение первым!</Text>
        )
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} /> : null}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${item.title}. ${item.postsCount} сообщений, автор ${item.author}${item.locked ? ', тема закрыта' : ''}`}
          onPress={() => router.push(`/forum/${item.id}`)}
          style={({ pressed }) => [styles.card, { backgroundColor: c.surface, borderColor: c.border, opacity: pressed ? 0.8 : 1 }]}
        >
          {item.questionSlug && !question && (
            <Text numberOfLines={1} style={[styles.question, { color: c.accent }]}>
              {questionBySlug.get(item.questionSlug)?.title ?? item.questionSlug}
            </Text>
          )}
          <Text style={[styles.title, { color: c.text }]}>
            {item.locked ? '🔒 ' : ''}
            {item.title}
          </Text>
          <View style={styles.row}>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {item.author} · {relativeTime(item.lastPostAt, now)}
            </Text>
            <View style={styles.count}>
              <Ionicons name="chatbubble-outline" size={14} color={c.textMuted} />
              <Text style={[styles.meta, { color: c.textMuted }]}>{item.postsCount}</Text>
            </View>
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10, paddingBottom: 96 },
  header: { gap: 8, marginBottom: 6 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  question: { fontSize: 12, fontWeight: '700' },
  title: { fontSize: 16, fontWeight: '700', lineHeight: 21 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { fontSize: 13 },
  empty: { fontSize: 15, textAlign: 'center', paddingVertical: 24 },
});
