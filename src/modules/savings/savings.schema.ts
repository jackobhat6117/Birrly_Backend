import { z } from 'zod';
import { moneyFieldSchema } from '@/shared/utils/validation';

export const createSavingsGoalSchema = z.object({
  name: z.string().min(1).max(80),
  targetAmount: moneyFieldSchema,
  currency: z.string().min(3).max(8).optional(),
});

export const contributeSavingsSchema = z.object({
  amount: moneyFieldSchema,
});

export const updateSavingsPaceSchema = z.object({
  plannedSpend: moneyFieldSchema,
});
