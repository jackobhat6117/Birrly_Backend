import type { ProductEventName } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import { sanitizeProductEvents } from '@/modules/analytics/analytics.constants';

export class AnalyticsService {
  constructor(private readonly db: DbClient) {}

  async ingest(userId: string, rawEvents: unknown): Promise<{ accepted: number }> {
    const events = sanitizeProductEvents(rawEvents);
    if (events.length === 0) {
      return { accepted: 0 };
    }

    await this.db.$transaction([
      this.db.productEvent.createMany({
        data: events.map((event) => ({
          userId,
          name: event.name as ProductEventName,
          screen: event.screen,
        })),
      }),
      this.db.user.update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      }),
    ]);

    return { accepted: events.length };
  }
}
