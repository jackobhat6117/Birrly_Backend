import { createHmac, timingSafeEqual } from 'node:crypto';
import { UnauthorizedError } from '@/shared/errors/app-error';

export type WebTokenPayload = {
  /** Internal user UUID */
  sub: string;
  /** Telegram user ID */
  tid: string;
};

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signWebToken(
  payload: WebTokenPayload,
  secret: string,
  expiresSec: number,
): { token: string; expiresAt: string } {
  const header = base64urlJson({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresSec;
  const body = base64urlJson({ ...payload, iat: now, exp });
  const data = `${header}.${body}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');
  return {
    token: `${data}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyWebToken(token: string, secret: string): WebTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new UnauthorizedError();
  const [header, body, signature] = parts as [string, string, string];

  const data = `${header}.${body}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new UnauthorizedError();
  }

  let payload: { sub?: unknown; tid?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as typeof payload;
  } catch {
    throw new UnauthorizedError();
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError();
  }
  if (typeof payload.sub !== 'string' || typeof payload.tid !== 'string') {
    throw new UnauthorizedError();
  }

  return { sub: payload.sub, tid: payload.tid };
}
