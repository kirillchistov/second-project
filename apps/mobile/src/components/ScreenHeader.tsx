import { useColors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/** Заголовок экрана поверх вкладок: «назад» (или на главную, если экран открыт первым) и название */
export function ScreenHeader({ title, right }: { title: string; right?: ReactNode }) {
  const c = useColors();
  return (
    <View style={[styles.root, { borderBottomColor: c.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Назад"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <Ionicons name="chevron-back" size={26} color={c.accent} />
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: c.text }]}>
        {title}
      </Text>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 17, fontWeight: '700' },
  right: { minWidth: 26, alignItems: 'flex-end' },
});
