import { useNow } from '@/lib/now';
import { useProgress } from '@/lib/progress';
import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { dueCount } from '@rr/core';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  const c = useColors();
  const { cards, backlog } = useProgress();
  const toReview = backlog.length + dueCount(cards, useNow());

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Путь', tabBarIcon: ({ color, size }) => <Ionicons name="git-commit" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="review"
        options={{
          title: 'Повтор',
          tabBarBadge: toReview > 0 ? toReview : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="refresh" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Профиль', tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
