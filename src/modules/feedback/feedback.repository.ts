import type { Feedback, FeedbackCategory, FeedbackSource, Prisma } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import type { FeedbackDto } from '@/modules/feedback/feedback.types';
import { normalizePagination, paginationMeta } from '@/shared/utils/pagination';

export type AdminFeedbackListQuery = {
  q?: string;
  category?: FeedbackCategory;
  source?: FeedbackSource;
  page?: number;
  pageSize?: number;
};

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

  async listForAdmin(query: AdminFeedbackListQuery) {
    const { skip, take, page, pageSize } = normalizePagination(query);
    const search = query.q?.trim();
    const where: Prisma.FeedbackWhereInput = {
      ...(query.category ? { category: query.category } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(search
        ? {
            OR: [
              { message: { contains: search, mode: 'insensitive' } },
              { pageContext: { contains: search, mode: 'insensitive' } },
              { user: { firstName: { contains: search, mode: 'insensitive' } } },
              { user: { lastName: { contains: search, mode: 'insensitive' } } },
              { user: { telegramUsername: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.feedback.count({ where }),
      this.db.feedback.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          category: true,
          message: true,
          source: true,
          pageContext: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramUsername: true,
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        category: row.category,
        message: row.message,
        source: row.source,
        pageContext: row.pageContext,
        createdAt: row.createdAt.toISOString(),
        user: {
          id: row.user.id,
          firstName: row.user.firstName,
          lastName: row.user.lastName,
          telegramUsername: row.user.telegramUsername,
        },
      })),
      meta: paginationMeta(total, page, pageSize),
    };
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
