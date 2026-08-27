import { createHmac, timingSafeEqual } from 'node:crypto';
import { TELEGRAM_INIT_DATA_MAX_AGE_SECONDS } from '@/shared/constants/app';
import { UnauthorizedError } from '@/shared/errors/app-error';

export type TelegramAuthUser = {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
};

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

function safeEqualHex(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left, 'hex');
  const rightBuf = Buffer.from(right, 'hex');
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

export function verifyTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds: number = TELEGRAM_INIT_DATA_MAX_AGE_SECONDS,
): TelegramAuthUser {
  if (!initData || !botToken) {
    throw new UnauthorizedError();
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new UnauthorizedError();
  }

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = hmacSha256('WebAppData', botToken);
  const computed = hmacSha256(secretKey, dataCheckString).toString('hex');

  if (!safeEqualHex(computed, hash)) {
    throw new UnauthorizedError('Telegram authentication data is invalid.');
  }

  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate)) {
    throw new UnauthorizedError();
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - authDate;
  if (ageSeconds > maxAgeSeconds) {
    throw new UnauthorizedError('Telegram authentication data has expired.');
  }

  const userRaw = params.get('user');
  if (!userRaw) {
    throw new UnauthorizedError();
  }

  let user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    language_code?: string;
  };
  try {
    user = JSON.parse(userRaw) as typeof user;
  } catch {
    throw new UnauthorizedError();
  }

  return {
    telegramId: String(user.id),
    username: user.username,
    firstName: user.first_name,
    lastName: user.last_name,
    languageCode: user.language_code,
  };
}
