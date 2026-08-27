import { z } from 'zod';
import { moneyFieldSchema } from '@/shared/utils/validation';

export const updateProfileSchema = z.object({
  language: z.enum(['en', 'am']).optional(),
  currency: z.string().min(3).max(8).optional(),
  timezone: z.string().min(1).max(64).optional(),
  monthlyIncome: moneyFieldSchema.nullable().optional(),
  paydayDay: z.number().int().min(1).max(31).nullable().optional(),
});
