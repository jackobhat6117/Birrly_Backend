import { describe, expect, it } from 'vitest';
import { hashPassword, signAdminToken, verifyAdminToken, verifyPassword } from '@/modules/admin/admin.auth';
import { funnelSteps } from '@/modules/admin/admin.funnel';
import { UnauthorizedError } from '@/shared/errors/app-error';

describe('admin auth', () => {
  it('hashes and verifies passwords', async () => {
    const stored = await hashPassword('changeme-admin');
    expect(await verifyPassword('changeme-admin', stored)).toBe(true);
    expect(await verifyPassword('wrong-password', stored)).toBe(false);
  });

  it('signs and verifies a JWT', () => {
    const { token } = signAdminToken({ sub: 'adm-1', email: 'admin@birrly.local' }, 'secret', 60);
    expect(verifyAdminToken(token, 'secret')).toEqual({ sub: 'adm-1', email: 'admin@birrly.local' });
  });

  it('rejects a tampered token', () => {
    const { token } = signAdminToken({ sub: 'adm-1', email: 'admin@birrly.local' }, 'secret', 60);
    expect(() => verifyAdminToken(`${token}x`, 'secret')).toThrow(UnauthorizedError);
  });
});

describe('funnelSteps', () => {
  it('computes conversion against the first step', () => {
    expect(
      funnelSteps([
        { id: 'registered', label: 'Registered', count: 100 },
        { id: 'openedApp', label: 'Opened Mini App', count: 40 },
      ]),
    ).toEqual([
      { id: 'registered', label: 'Registered', count: 100, percent: 100 },
      { id: 'openedApp', label: 'Opened Mini App', count: 40, percent: 40 },
    ]);
  });
});
