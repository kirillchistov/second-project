import { Button } from '@/components/ui';
import { fetchLeaderboard, type LeaderboardEntry } from '@/lib/account';
import { useNow } from '@/lib/now';
import { useAccount } from '@/lib/session';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { localDay } from '@rr/core';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MEDALS = ['🥇', '🥈', '🥉'];

/** Лига: недельный рейтинг по XP за уроки и повторения. Видны только ники. */
export default function LeagueScreen() {
  const c = useColors();
  const account = useAccount();
  const today = localDay(useNow());
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetchLeaderboard(today);
      setEntries(res.entries);
      setError(null);
    } catch {
      setError('Не удалось загрузить лигу. Проверь связь с сервером.');
    }
  }, [today]);

  // Перечитываем при каждом открытии вкладки: XP мог прибавиться после урока
  useFocusEffect(
    useCallback(() => {
      if (account.status === 'signed-in') void load();
    }, [account.status, load]),
  );

  if (account.status !== 'signed-in') {
    return (
      <SafeAreaView style={[styles.root, styles.center, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
        <Ionicons name="trophy" size={56} color={c.warning} />
        <Text style={[styles.title, { color: c.text }]}>Лига недели</Text>
        <Text style={[styles.lead, { color: c.textMuted }]}>
          Войди в аккаунт, чтобы соревноваться с друзьями: рейтинг по XP за неделю, с понедельника заново.
        </Text>
        <Button title="Войти или создать аккаунт" onPress={() => router.push('/account')} style={styles.wide} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right']}>
      <FlatList
        data={entries ?? []}
        keyExtractor={(e) => `${e.rank}-${e.nickname}`}
        contentContainerStyle={styles.list}
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
            <Text style={[styles.title, { color: c.text }]}>Лига недели</Text>
            <Text style={[styles.lead, { color: c.textMuted }]}>XP за уроки и повторения с понедельника. Квесты не считаются.</Text>
            {error && <Text style={[styles.lead, { color: c.danger }]}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={
          entries === null && !error ? (
            <ActivityIndicator color={c.accent} />
          ) : (
            <Text style={[styles.lead, { color: c.textMuted }]}>На этой неделе ещё никто не занимался. Стань первым!</Text>
          )
        }
        renderItem={({ item }) => (
          <View
            accessible
            accessibilityLabel={`${item.rank} место: ${item.nickname}, ${item.xp} XP${item.me ? ', это ты' : ''}`}
            style={[
              styles.row,
              { backgroundColor: item.me ? c.accentSoft : c.surface, borderColor: item.me ? c.accent : c.border },
            ]}
          >
            <Text style={[styles.rank, { color: c.textMuted }]}>{MEDALS[item.rank - 1] ?? item.rank}</Text>
            <Text style={[styles.nick, { color: c.text }]} numberOfLines={1}>
              {item.nickname}
              {item.me ? ' · ты' : ''}
            </Text>
            <Text style={[styles.xp, { color: c.warning }]}>{item.xp} XP</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  wide: { alignSelf: 'stretch', marginTop: 8 },
  list: { padding: 16, gap: 8 },
  header: { gap: 6, marginBottom: 8 },
  title: { fontSize: 28, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 21, textAlign: 'left' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  rank: { width: 32, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  nick: { flex: 1, fontSize: 16, fontWeight: '700' },
  xp: { fontSize: 16, fontWeight: '800' },
});
