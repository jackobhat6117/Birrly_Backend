import type { FeedbackSource } from '@prisma/client';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';
import type { CreateFeedbackInput } from '@/modules/feedback/feedback.schema';
import type { FeedbackRepository } from '@/modules/feedback/feedback.repository';
import { toFeedbackDto } from '@/modules/feedback/feedback.repository';
import type { FeedbackDto } from '@/modules/feedback/feedback.types';

const DAILY_LIMIT = 10;

export class FeedbackService {
  constructor(private readonly feedback: FeedbackRepository) {}

  async create(
    userId: string,
    input: CreateFeedbackInput,
    source: FeedbackSource,
  ): Promise<FeedbackDto> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.feedback.countRecentForUser(userId, since);
    if (recent >= DAILY_LIMIT) {
      throw new AppError(
        ERROR_CODE.RATE_LIMITED,
        'You have sent too much feedback today. Please try again tomorrow.',
        429,
      );
    }

    const created = await this.feedback.create({
      user: { connect: { id: userId } },
      category: input.category ?? 'OTHER',
      message: input.message.trim(),
      source,
      pageContext: input.pageContext?.trim() || null,
    });

    return toFeedbackDto(created);
  }
}
