import { migrate } from '@/lib/db';
import { ProgressProvider } from '@/components/ProgressProvider';
import { useColors } from '@/lib/theme';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const c = useColors();
  return (
    <SQLiteProvider databaseName="progress.db" onInit={migrate}>
      <ProgressProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        </Stack>
      </ProgressProvider>
    </SQLiteProvider>
  );
}
