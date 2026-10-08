import { z } from 'zod';

export const createGroupSavingsSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(64, 'Name too long'),
  targetAmount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  currency: z.string().trim().length(3).optional().default('ETB'),
  description: z.string().trim().max(256).optional(),
  targetDate: z.string().optional(),
});

export const updateGroupSavingsSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  targetAmount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  description: z.string().trim().max(256).optional(),
  targetDate: z.string().optional(),
});

export const addGroupContributionSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  note: z.string().trim().max(256).optional(),
  contributedAt: z.string().optional(),
});

export const joinGroupSavingsSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

export const addMemberByTelegramIdSchema = z.object({
  telegramId: z.string().trim().min(1, 'Telegram ID is required'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
});

export const linkTelegramChatSchema = z.object({
  telegramChatId: z.string().trim().min(1),
});
