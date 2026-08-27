import { z } from 'zod';
import { isoDateSchema, moneyFieldSchema } from '@/shared/utils/validation';

export const createDebtSchema = z.object({
  personName: z.string().min(1).max(80),
  type: z.enum(['OWED_TO_ME', 'I_OWE']),
  amount: moneyFieldSchema,
  currency: z.string().min(3).max(8).optional(),
  dueDate: isoDateSchema.optional(),
  note: z.string().max(280).optional(),
});

export const createDebtPaymentSchema = z.object({
  amount: moneyFieldSchema,
  note: z.string().max(280).optional(),
});
