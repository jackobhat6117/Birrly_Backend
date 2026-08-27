import { z } from 'zod';
import { moneyFieldSchema } from '@/shared/utils/validation';

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  amount: moneyFieldSchema,
  currency: z.string().min(3).max(8).optional(),
});

export const updateBudgetSchema = z.object({
  amount: moneyFieldSchema,
});

export const listBudgetsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
