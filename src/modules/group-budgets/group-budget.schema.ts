import { z } from 'zod';

export const createGroupBudgetSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(64, 'Name too long'),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  currency: z.string().trim().length(3).optional().default('ETB'),
  description: z.string().trim().max(256).optional(),
  periodUnit: z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR']).optional().default('MONTH'),
  periodCount: z.number().int().min(1).max(52).optional().default(1),
  startDate: z.string().optional(),
});

export const updateGroupBudgetSchema = z.object({
  name: z.string().trim().min(1).max(64).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/).optional(),
  description: z.string().trim().max(256).optional(),
});

export const addGroupExpenseSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid amount format'),
  categoryId: z.string().uuid().optional(),
  description: z.string().trim().max(256).optional(),
  spentAt: z.string().optional(),
});

export const joinGroupBudgetSchema = z.object({
  token: z.string().trim().min(1, 'Token is required'),
});

export const addMemberByTelegramIdSchema = z.object({
  telegramId: z.string().trim().min(1, 'Telegram ID is required'),
  role: z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']).optional().default('MEMBER'),
});

export const linkTelegramChatSchema = z.object({
  telegramChatId: z.string().trim().min(1),
});
