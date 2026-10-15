import { Button } from '@/components/ui';
import { authErrorMessage, signIn, signUp } from '@/lib/account';
import { useColors, type Colors } from '@/lib/theme';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Mode = 'signin' | 'signup';

/** Экран мог открыться первым (по ссылке) — тогда возвращаться некуда, уходим в профиль */
function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/profile');
}

function Field({ label, c, ...props }: TextInputProps & { label: string; c: Colors }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        // Автокоррекция портит email и ники
        autoCorrect={false}
        spellCheck={false}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.surface }]}
        {...props}
      />
    </View>
  );
}

/** Вход и регистрация: модальный экран поверх профиля */
export default function AccountScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = email.includes('@') && password.length >= (mode === 'signup' ? 8 : 1) && (mode === 'signin' || nickname.trim().length >= 3);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signup') await signUp({ email, password, nickname: nickname.trim() });
      else await signIn({ email, password });
      close();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: c.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* SafeAreaView меряет реальное перекрытие: в модальном листе сверху отступа нет, на весь экран — есть */}
      <SafeAreaView style={styles.root} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={[styles.title, { color: c.text }]}>{mode === 'signin' ? 'Вход' : 'Новый аккаунт'}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Закрыть" onPress={close} hitSlop={12}>
              <Ionicons name="close" size={28} color={c.textMuted} />
            </Pressable>
          </View>
          <Text style={[styles.lead, { color: c.textMuted }]}>
            Аккаунт сохраняет прогресс на сервере: он переживёт смену телефона, а в «Лиге» ты увидишь себя среди друзей.
          </Text>

          <View style={[styles.switch, { backgroundColor: c.surfaceAlt }]} accessibilityRole="tablist">
            {(['signin', 'signup'] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
                style={[styles.switchItem, mode === m && { backgroundColor: c.surface }]}
              >
                <Text style={[styles.switchText, { color: mode === m ? c.text : c.textMuted }]}>
                  {m === 'signin' ? 'Войти' : 'Регистрация'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Field
            c={c}
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            placeholder="you@example.com"
          />
          {mode === 'signup' && (
            <Field
              c={c}
              label="Ник — его увидят в лиге"
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              autoComplete="username-new"
              textContentType="nickname"
              placeholder="react_ninja"
              maxLength={24}
            />
          )}
          <Field
            c={c}
            label={mode === 'signup' ? 'Пароль — от 8 символов' : 'Пароль'}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            textContentType={mode === 'signup' ? 'newPassword' : 'password'}
            onSubmitEditing={() => ready && !busy && submit()}
          />

          {error && (
            <Text accessibilityRole="alert" style={[styles.error, { color: c.danger }]}>
              {error}
            </Text>
          )}
          {busy ? (
            <ActivityIndicator style={styles.spinner} color={c.accent} />
          ) : (
            <Button title={mode === 'signin' ? 'Войти' : 'Создать аккаунт'} onPress={submit} disabled={!ready} />
          )}
          <Text style={[styles.note, { color: c.textMuted }]}>
            Прогресс с этого телефона не потеряется: после входа он объединится с тем, что уже есть в аккаунте.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  title: { fontSize: 28, fontWeight: '800' },
  lead: { fontSize: 15, lineHeight: 21 },
  switch: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  switchItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  switchText: { fontSize: 15, fontWeight: '700' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { fontSize: 14, fontWeight: '600' },
  spinner: { paddingVertical: 14 },
  note: { fontSize: 13, lineHeight: 18 },
});
