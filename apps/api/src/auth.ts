/**
 * Пароли и токены сессий — на node:crypto, без сторонних зависимостей.
 *
 * Пароль: scrypt (memory-hard KDF) со случайной солью; параметры хранятся рядом с хэшем,
 * поэтому их можно усилить позже, не ломая старые хэши. Сравнение — за постоянное время.
 * Сессия: 32 случайных байта; клиент получает сам токен, в базе — только его SHA-256.
 */
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const scrypt = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, keylen, options, (error, key) => (error ? reject(error) : resolve(key))),
  );

/** N = 2^15, r = 8, p = 1 — рекомендация OWASP для scrypt; ~32 МБ памяти на хэш */
const PARAMS = { N: 2 ** 15, r: 8, p: 1 } as const;
const KEY_LENGTH = 64;
const MAX_MEMORY = 128 * PARAMS.N * PARAMS.r * 2;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, { ...PARAMS, maxmem: MAX_MEMORY });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const params = { N: Number(n), r: Number(r), p: Number(p) };
  const key = await scrypt(password.normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length, {
    ...params,
    maxmem: 128 * params.N * params.r * 2,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Хэш-«пустышка» для входа с несуществующим email: проверка пароля идёт всегда,
 * и по времени ответа нельзя узнать, зарегистрирован ли адрес.
 */
let dummyHash: Promise<string> | null = null;
export function dummyPasswordHash(): Promise<string> {
  dummyHash ??= hashPassword(randomBytes(16).toString('hex'));
  return dummyHash;
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Срок жизни сессии; при активности продлевается */
export const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'rr_session';
