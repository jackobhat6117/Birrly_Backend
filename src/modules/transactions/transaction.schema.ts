import { z } from 'zod';
import { isoDateSchema, moneyFieldSchema, paginationQuerySchema } from '@/shared/utils/validation';

export const createTransactionSchema = z.object({
  type: z.enum(['EXPENSE', 'INCOME']),
  amount: moneyFieldSchema,
  currency: z.string().min(3).max(8).optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  categorySlug: z.string().min(1).optional(),
  description: z.string().max(280).optional(),
  transactionDate: isoDateSchema.optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const updateTransactionSchema = z.object({
  amount: moneyFieldSchema.optional(),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  description: z.string().max(280).nullable().optional(),
  transactionDate: isoDateSchema.optional(),
});

export const listTransactionsQuerySchema = paginationQuerySchema.extend({
  type: z.enum(['EXPENSE', 'INCOME']).optional(),
  categoryId: z.string().uuid().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});
