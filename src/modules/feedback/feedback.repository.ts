import type { Feedback, Prisma } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import type { FeedbackDto } from '@/modules/feedback/feedback.types';

export class FeedbackRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Prisma.FeedbackCreateInput): Promise<Feedback> {
    return this.db.feedback.create({ data });
  }

  async countRecentForUser(userId: string, since: Date): Promise<number> {
    return this.db.feedback.count({
      where: { userId, createdAt: { gte: since } },
    });
  }
}

export function toFeedbackDto(row: Feedback): FeedbackDto {
  return {
    id: row.id,
    category: row.category,
    message: row.message,
    source: row.source,
    pageContext: row.pageContext,
    createdAt: row.createdAt.toISOString(),
  };
}
