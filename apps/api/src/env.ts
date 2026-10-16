import Anthropic from '@anthropic-ai/sdk';
import type { AppOptions } from './app.ts';
import { claudeExaminer } from './examiner.ts';

/**
 * Настройки API из переменных окружения — общие для локального сервера (main.ts) и функции Vercel (index.ts).
 * ANTHROPIC_API_KEY, ANTHROPIC_WORKSPACE_ID, APP_TOKEN, DAILY_LIMIT, ALLOWED_ORIGINS, COOKIE_SECURE.
 */
export function optionsFromEnv(env: NodeJS.ProcessEnv = process.env): Pick<AppOptions, 'examiner' | 'token' | 'dailyLimit' | 'allowedOrigins' | 'secureCookies'> {
  const workspace = env.ANTHROPIC_WORKSPACE_ID?.trim();
  const client = new Anthropic(workspace ? { defaultHeaders: { 'anthropic-workspace-id': workspace } } : {});
  return {
    examiner: claudeExaminer(client),
    token: env.APP_TOKEN || undefined,
    dailyLimit: env.DAILY_LIMIT ? Number(env.DAILY_LIMIT) : undefined,
    allowedOrigins: (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    // Secure-cookie не уходит по http — локально без HTTPS его отключают
    secureCookies: env.COOKIE_SECURE !== 'false',
  };
}
