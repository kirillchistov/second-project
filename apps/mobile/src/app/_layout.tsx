import { ConfettiHost } from '@/components/ConfettiHost';
import { ProgressProvider } from '@/components/ProgressProvider';
import { useColors } from '@/lib/theme';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  const c = useColors();
  return (
    <ProgressProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lesson/[id]" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
        <Stack.Screen name="account" options={{ presentation: 'modal' }} />
      </Stack>
      <ConfettiHost />
    </ProgressProvider>
  );
}
