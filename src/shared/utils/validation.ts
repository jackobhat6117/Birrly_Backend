import { z } from 'zod';
import { PAGINATION } from '@/shared/constants/app';
import { assertPositiveMoney } from '@/shared/utils/money';

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(PAGINATION.defaultPage),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.maxPageSize)
    .optional()
    .default(PAGINATION.defaultPageSize),
});

export const moneyFieldSchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    return assertPositiveMoney(value).toFixed(2);
  } catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid amount',
    });
    return z.NEVER;
  }
});

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
