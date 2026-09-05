import { describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from '@/modules/subscriptions/subscription.service';

describe('SubscriptionService', () => {
  it('generates unique upgrade request reference codes starting with BIRRLY-', async () => {
    const mockDb: any = {
      subscriptionUpgradeRequest: {
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'req-1', ...data, amount: { toFixed: () => '200.00' }, createdAt: new Date() })),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
    };

    const service = new SubscriptionService(mockDb);
    const result = await service.createOrGetUpgradeRequest('user-1', 'PREMIUM_MONTHLY');

    expect(result.referenceCode).toMatch(/^BIRRLY-\d{5}$/);
    expect(result.plan).toBe('PREMIUM_MONTHLY');
    expect(result.amount).toBe('200.00');
    expect(mockDb.subscriptionUpgradeRequest.create).toHaveBeenCalled();
  });

  it('correctly calculates expired subscriptions as effective FREE plan', async () => {
    const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24); // 1 day ago
    const mockDb: any = {
      subscription: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
          plan: 'PREMIUM_MONTHLY',
          status: 'ACTIVE',
          source: 'TELEBIRR',
          currentPeriodEnd: pastDate,
        }),
      },
    };

    const service = new SubscriptionService(mockDb);
    const access = await service.getAccess('user-1');

    expect(access.storedPlan).toBe('PREMIUM_MONTHLY');
    expect(access.effectivePlan).toBe('FREE');
    expect(access.status).toBe('EXPIRED');
    expect(access.entitlements.AI_NATURAL_LANGUAGE).toBe(false);
  });

  it('identifies active trials and calculates days remaining', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days left
    const mockDb: any = {
      subscription: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
          plan: 'PREMIUM_MONTHLY',
          status: 'ACTIVE',
          source: 'SIGNUP_TRIAL',
          currentPeriodEnd: futureDate,
        }),
      },
    };

    const service = new SubscriptionService(mockDb);
    const access = await service.getAccess('user-1');

    expect(access.effectivePlan).toBe('PREMIUM_MONTHLY');
    expect(access.isTrial).toBe(true);
    expect(access.daysRemaining).toBe(5);
    expect(access.entitlements.AI_NATURAL_LANGUAGE).toBe(true);
  });
});
