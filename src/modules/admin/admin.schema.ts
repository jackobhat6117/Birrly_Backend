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

export const adminGrantSubscriptionSchema = z.object({
  plan: z.enum(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']).default('PREMIUM_MONTHLY'),
  months: z.coerce.number().int().positive().max(24).optional(),
  note: z.string().trim().max(240).optional(),
});

export const adminRevokeSubscriptionSchema = z.object({
  note: z.string().trim().max(240).optional(),
});

export const adminUpgradeRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export const adminReviewUpgradeRequestSchema = z.object({
  note: z.string().trim().max(240).optional(),
});

export const adminCreatePromoSchema = z.object({
  code: z.string().trim().min(3).max(40),
  plan: z.enum(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']).default('PREMIUM_MONTHLY'),
  durationDays: z.coerce.number().int().positive().max(730),
  maxUses: z.coerce.number().int().positive().max(100_000).default(100),
  expiresAt: z.string().datetime().optional(),
  note: z.string().trim().max(240).optional(),
});

export const upgradeRequestIdSchema = z.object({
  id: z.string().uuid(),
});
