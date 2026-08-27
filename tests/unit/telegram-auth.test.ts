import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyTelegramInitData } from '@/integrations/telegram/telegram-auth';
import { UnauthorizedError } from '@/shared/errors/app-error';

function signInitData(botToken: string, user: object): string {
  const params = new URLSearchParams();
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  params.set('query_id', 'test');
  params.set('user', JSON.stringify(user));

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  params.set('hash', hash);
  return params.toString();
}

describe('telegram init data', () => {
  const token = '123456:test-token';

  it('accepts valid Mini App init data', () => {
    const initData = signInitData(token, {
      id: 99,
      username: 'abebe',
      first_name: 'Abebe',
    });

    const user = verifyTelegramInitData(initData, token);
    expect(user.telegramId).toBe('99');
    expect(user.username).toBe('abebe');
  });

  it('rejects tampered data', () => {
    const initData = signInitData(token, { id: 1 });
    expect(() => verifyTelegramInitData(`${initData}&user=%7B%22id%22%3A2%7D`, token)).toThrow(
      UnauthorizedError,
    );
  });
});
