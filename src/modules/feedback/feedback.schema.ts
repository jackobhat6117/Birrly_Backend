import { z } from 'zod';

export const createFeedbackSchema = z.object({
  category: z.enum(['BUG', 'IDEA', 'OTHER']).optional().default('OTHER'),
  message: z.string().trim().min(3).max(2000),
  pageContext: z.string().trim().max(200).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
