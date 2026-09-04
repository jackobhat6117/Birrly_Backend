import type { FeedbackCategory, FeedbackSource } from '@prisma/client';

export type FeedbackDto = {
  id: string;
  category: FeedbackCategory;
  message: string;
  source: FeedbackSource;
  pageContext: string | null;
  createdAt: string;
};
