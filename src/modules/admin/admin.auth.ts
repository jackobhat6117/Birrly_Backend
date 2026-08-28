import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { UnauthorizedError } from '@/shared/errors/app-error';

const scrypt = promisify(scryptCb);

export type AdminTokenPayload = {
  sub: string;
  email: string;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, 'base64url');
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function signAdminToken(
  payload: AdminTokenPayload,
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

export function verifyAdminToken(token: string, secret: string): AdminTokenPayload {
  const parts = token.split('.');
  const header = parts[0];
  const body = parts[1];
  const signature = parts[2];
  if (!header || !body || !signature) {
    throw new UnauthorizedError();
  }

  const data = `${header}.${body}`;
  const expected = createHmac('sha256', secret).update(data).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new UnauthorizedError();
  }

  let payload: { sub?: unknown; email?: unknown; exp?: unknown };
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub?: unknown;
      email?: unknown;
      exp?: unknown;
    };
  } catch {
    throw new UnauthorizedError();
  }

  if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new UnauthorizedError();
  }
  if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
    throw new UnauthorizedError();
  }

  return { sub: payload.sub, email: payload.email };
}
