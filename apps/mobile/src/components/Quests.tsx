import { ProgressBar } from '@/components/ui';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QUEST_XP, type QuestProgress } from '@rr/core';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Квесты дня: три цели с прогрессом и подсказкой про сундук. */
export function QuestList({ quests }: { quests: readonly QuestProgress[] }) {
  const c = useColors();
  if (quests.length === 0) return null;
  const done = quests.filter((q) => q.done).length;
  const all = done === quests.length;
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: all ? c.success : c.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: c.text }]}>Квесты дня</Text>
        <View style={styles.chest}>
          <Ionicons name={all ? 'gift' : 'gift-outline'} size={16} color={all ? c.success : c.textMuted} />
          <Text style={[styles.chestText, { color: all ? c.success : c.textMuted }]}>
            {all ? 'сундук открыт' : `${done}/${quests.length} до сундука`}
          </Text>
        </View>
      </View>
      {quests.map((q) => (
        <View
          key={q.id}
          style={styles.row}
          accessible
          accessibilityLabel={`${q.title}: ${q.value} из ${q.target}${q.done ? ', выполнено' : ''}`}
        >
          <Ionicons name={(q.done ? 'checkmark-circle' : q.icon) as IconName} size={22} color={q.done ? c.success : c.accent} />
          <View style={styles.body}>
            <Text style={[styles.quest, { color: q.done ? c.textMuted : c.text }]}>{q.title}</Text>
            <View style={styles.progress}>
              <ProgressBar value={q.value / q.target} color={q.done ? c.success : c.accent} />
              <Text style={[styles.count, { color: c.textMuted }]}>
                {q.done ? `+${QUEST_XP} XP` : `${q.value}/${q.target}`}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 17, fontWeight: '800' },
  chest: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chestText: { fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, gap: 4 },
  quest: { fontSize: 14, fontWeight: '600' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  count: { fontSize: 12, fontWeight: '600', minWidth: 44, textAlign: 'right' },
});
