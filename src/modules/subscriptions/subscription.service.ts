import type { DbClient } from '@/database/prisma';
import { entitlementsForPlan } from '@/modules/subscriptions/subscription.entitlements';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';
import type { Feature } from '@/shared/constants/features';

export class SubscriptionService {
  constructor(private readonly db: DbClient) {}

  async ensureFreePlan(userId: string): Promise<void> {
    await this.db.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
  }

  async canAccess(userId: string, feature: Feature): Promise<boolean> {
    const subscription = await this.db.subscription.findUnique({
      where: { userId },
    });

    const plan = subscription?.plan ?? 'FREE';
    const status = subscription?.status ?? 'ACTIVE';
    if (status !== 'ACTIVE') {
      return entitlementsForPlan('FREE')[feature];
    }

    return entitlementsForPlan(plan)[feature];
  }

  async assertCanAccess(userId: string, feature: Feature): Promise<void> {
    const allowed = await this.canAccess(userId, feature);
    if (!allowed) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        'This feature requires a premium subscription.',
        402,
      );
    }
  }

  async getForUser(userId: string) {
    return this.db.subscription.findUnique({
      where: { userId },
    });
  }

  async getAccess(userId: string) {
    const subscription = await this.getForUser(userId);
    const storedPlan = subscription?.plan ?? 'FREE';
    const status = subscription?.status ?? 'ACTIVE';
    const effectivePlan = status === 'ACTIVE' ? storedPlan : 'FREE';
    return {
      storedPlan,
      status,
      effectivePlan,
      entitlements: entitlementsForPlan(effectivePlan),
    };
  }
}
