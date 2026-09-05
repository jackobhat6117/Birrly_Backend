import { z } from 'zod';

export const createUpgradeRequestSchema = z.object({
  plan: z.enum(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']),
});

export const redeemPromoSchema = z.object({
  code: z.string().trim().min(3).max(40),
});

export const adminGrantSubscriptionSchema = z.object({
  plan: z.enum(['PREMIUM_MONTHLY', 'PREMIUM_YEARLY']),
  months: z.coerce.number().int().positive().max(24).optional(),
  note: z.string().trim().max(240).optional(),
});

export const adminReviewUpgradeRequestSchema = z.object({
  note: z.string().trim().max(240).optional(),
});

export const adminUpgradeRequestsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).default('PENDING'),
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
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
