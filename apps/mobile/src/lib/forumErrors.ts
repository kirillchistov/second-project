import { ApiError } from '@/lib/api';

/** Понятное сообщение об ошибке форума по ответу сервера */
export function forumErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Что-то пошло не так. Попробуй ещё раз.';
  const body = error.body as { error?: string; fields?: Record<string, string[]> } | undefined;
  if (body?.fields) return Object.values(body.fields).flat()[0] ?? 'Проверь текст';
  switch (body?.error) {
    case 'too_many_requests':
      return 'Слишком часто. Подожди минуту и отправь снова.';
    case 'topic_locked':
      return 'Тема закрыта модератором, ответить нельзя.';
    case 'has_replies':
      return 'В теме уже есть ответы других — удалить её может только модератор.';
    case 'forbidden':
      return 'Это можно сделать только со своим сообщением.';
    case 'not_found':
      return 'Тема или сообщение удалены.';
  }
  if (error.kind === 'offline') return 'Нет связи с сервером.';
  if (error.kind === 'unauthorized') return 'Войди в аккаунт, чтобы писать на форуме.';
  return 'Сервер не ответил. Попробуй позже.';
}
