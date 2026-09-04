import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const adminUsersQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const adminFeedbackQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.enum(['BUG', 'IDEA', 'OTHER']).optional(),
  source: z.enum(['APP', 'BOT']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const adminUserIdSchema = z.object({
  id: z.string().uuid(),
});
