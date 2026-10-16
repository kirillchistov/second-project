import { PostBody } from '@/components/forum/PostBody';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Button } from '@/components/ui';
import { questionBySlug } from '@/lib/content';
import { deletePost, editPost, getTopic, relativeTime, replyTo, type Post, type TopicPage } from '@/lib/forum';
import { forumErrorMessage } from '@/lib/forumErrors';
import { useNow } from '@/lib/now';
import { useAccount } from '@/lib/session';
import { useColors } from '@/lib/theme';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/** Тема форума: сообщения по порядку и поле ответа. Долгое нажатие на своё сообщение — правка или удаление. */
export default function TopicScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useColors();
  const now = useNow();
  const account = useAccount();
  const signedIn = account.status === 'signed-in';
  const moderator = signedIn && account.user.role === 'moderator';
  // «Моё» сервер отмечает по сессии — после входа или выхода тему нужно перечитать
  const viewer = signedIn ? account.user.id : null;

  const [page, setPage] = useState<TopicPage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<Post | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let active = true;
    getTopic(id)
      .then((loaded) => active && setPage(loaded))
      .catch((e) => active && setLoadError(forumErrorMessage(e)));
    return () => {
      active = false;
    };
  }, [id, viewer]);

  async function loadMore() {
    if (!page?.next || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await getTopic(id, page.next);
      setPage((p) => (p ? { ...p, posts: [...p.posts, ...more.posts], next: more.next } : p));
    } catch {
      // попробуем при следующей прокрутке
    } finally {
      setLoadingMore(false);
    }
  }

  /** После отправки перечитываем все страницы до последней — новое сообщение в конце нити */
  async function reloadAll() {
    let fresh = await getTopic(id);
    while (fresh.next) {
      const more = await getTopic(id, fresh.next);
      fresh = { ...fresh, posts: [...fresh.posts, ...more.posts], next: more.next };
    }
    setPage(fresh);
  }

  async function send() {
    setSending(true);
    setSendError(null);
    try {
      if (editing) await editPost(editing.id, draft);
      else await replyTo(id, draft);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDraft('');
      setEditing(null);
      await reloadAll();
    } catch (e) {
      setSendError(forumErrorMessage(e));
    } finally {
      setSending(false);
    }
  }

  function actions(post: Post) {
    if (post.deleted || (!post.mine && !moderator)) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const remove = () =>
      Alert.alert('Удалить сообщение?', 'Текст пропадёт, в нити останется отметка об удалении.', [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost(post.id);
              await reloadAll();
            } catch (e) {
              Alert.alert('Не получилось', forumErrorMessage(e));
            }
          },
        },
      ]);
    Alert.alert('Сообщение', undefined, [
      ...(post.mine
        ? [
            {
              text: 'Править',
              onPress: () => {
                setEditing(post);
                setDraft(post.body);
              },
            },
          ]
        : []),
      { text: 'Удалить', style: 'destructive' as const, onPress: remove },
      { text: 'Отмена', style: 'cancel' as const },
    ]);
  }

  const question = page?.topic.questionSlug ? questionBySlug.get(page.topic.questionSlug) : undefined;
  const canWrite = signedIn && page && (!page.topic.locked || moderator);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top', 'left', 'right', 'bottom']}>
      <ScreenHeader title={page?.topic.title ?? 'Тема'} />
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {!page ? (
          <View style={styles.center}>
            {loadError ? <Text style={[styles.meta, { color: c.danger }]}>{loadError}</Text> : <ActivityIndicator color={c.accent} />}
          </View>
        ) : (
          <FlatList
            data={page.posts}
            keyExtractor={(p) => p.id}
            contentContainerStyle={styles.list}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListHeaderComponent={
              <View style={styles.topicHeader}>
                {question && <Text style={[styles.question, { color: c.accent }]}>Вопрос: {question.title}</Text>}
                <Text style={[styles.title, { color: c.text }]}>{page.topic.title}</Text>
                {page.topic.locked && <Text style={[styles.meta, { color: c.warning }]}>🔒 Тема закрыта модератором</Text>}
              </View>
            }
            ListFooterComponent={loadingMore ? <ActivityIndicator color={c.accent} /> : null}
            renderItem={({ item, index }) => (
              <Pressable
                onLongPress={() => actions(item)}
                accessibilityHint={item.mine || moderator ? 'Долгое нажатие — правка или удаление' : undefined}
                style={[
                  styles.post,
                  { backgroundColor: c.surface, borderColor: item.mine ? c.accent : c.border },
                  index === 0 && styles.firstPost,
                ]}
              >
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  {item.author}
                  {item.mine ? ' · ты' : ''} · {relativeTime(item.createdAt, now)}
                  {item.editedAt && !item.deleted ? ' · изменено' : ''}
                </Text>
                {item.deleted ? (
                  <Text style={[styles.deleted, { color: c.textMuted }]}>Сообщение удалено</Text>
                ) : (
                  <PostBody text={item.body} />
                )}
              </Pressable>
            )}
          />
        )}

        {page && (
          <View style={[styles.composer, { borderTopColor: c.border, backgroundColor: c.surface }]}>
            {!signedIn ? (
              <Button title="Войти, чтобы ответить" onPress={() => router.push('/account')} />
            ) : !canWrite ? (
              <Text style={[styles.meta, { color: c.textMuted }]}>Тема закрыта — ответить нельзя.</Text>
            ) : (
              <>
                {editing && (
                  <View style={styles.editing}>
                    <Text style={[styles.meta, { color: c.accent }]}>Правка сообщения</Text>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setEditing(null);
                        setDraft('');
                      }}
                    >
                      <Text style={[styles.meta, { color: c.textMuted }]}>Отмена</Text>
                    </Pressable>
                  </View>
                )}
                {sendError && (
                  <Text accessibilityRole="alert" style={[styles.meta, { color: c.danger }]}>
                    {sendError}
                  </Text>
                )}
                <View style={styles.inputRow}>
                  <TextInput
                    accessibilityLabel={editing ? 'Текст сообщения' : 'Ответ'}
                    value={draft}
                    onChangeText={setDraft}
                    multiline
                    maxLength={5000}
                    placeholder="Ответить…"
                    placeholderTextColor={c.textMuted}
                    style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.bg }]}
                  />
                  {sending ? (
                    <ActivityIndicator color={c.accent} style={styles.send} />
                  ) : (
                    <Button title={editing ? 'Сохранить' : 'Отправить'} onPress={send} disabled={draft.trim().length === 0} style={styles.send} />
                  )}
                </View>
              </>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  list: { padding: 16, gap: 10 },
  topicHeader: { gap: 6, marginBottom: 6 },
  question: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '800', lineHeight: 28 },
  post: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  firstPost: { borderWidth: 2 },
  meta: { fontSize: 13 },
  deleted: { fontSize: 14, fontStyle: 'italic' },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, padding: 12, gap: 8 },
  editing: { flexDirection: 'row', justifyContent: 'space-between' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, maxHeight: 140, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  send: { paddingHorizontal: 14 },
});
