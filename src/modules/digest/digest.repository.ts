import type { DbClient } from '@/database/prisma';

/**
 * Reads only — finds who is eligible for the monthly digest. Business rules
 * (what "premium" means, entitlement checks) stay in the services this feeds;
 * this just narrows the fan-out to active, non-free subscribers.
 */
export class DigestRepository {
  constructor(private readonly db: DbClient) {}

  async listEligibleUserIds(now: Date = new Date()): Promise<string[]> {
    const rows = await this.db.subscription.findMany({
      where: {
        plan: { not: 'FREE' },
        status: 'ACTIVE',
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
      },
      select: { userId: true },
    });
    return rows.map((row) => row.userId);
  }
}
