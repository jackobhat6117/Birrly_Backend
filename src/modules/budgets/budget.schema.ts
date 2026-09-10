import { z } from 'zod';
import { moneyFieldSchema } from '@/shared/utils/validation';

const scopeSchema = z.enum(['ADDED_ONLY', 'ALL_TRANSACTIONS']);
const periodUnitSchema = z.enum(['WEEK', 'MONTH', 'QUARTER', 'YEAR']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createBudgetSchema = z
  .object({
    name: z.string().min(1).max(80).optional(),
    color: z.string().min(1).max(32).optional(),
    amount: moneyFieldSchema,
    currency: z.string().min(3).max(8).optional(),
    scope: scopeSchema.optional(),
    periodUnit: periodUnitSchema.optional(),
    periodCount: z.coerce.number().int().min(1).max(24).optional(),
    startDate: isoDate.optional(),
    includeIncome: z.boolean().optional(),
    includeLentBorrowed: z.boolean().optional(),
    includeCategoryIds: z.array(z.string().uuid()).max(50).optional(),
    excludeCategoryIds: z.array(z.string().uuid()).max(50).optional(),
    accountIds: z.array(z.string().uuid()).max(20).optional(),
    // Legacy single-category form (still accepted).
    categoryId: z.string().uuid().optional(),
  })
  .refine(
    (v) => Boolean(v.categoryId) || (v.includeCategoryIds && v.includeCategoryIds.length > 0),
    { message: 'At least one category is required.', path: ['includeCategoryIds'] },
  );

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().min(1).max(32).optional(),
  amount: moneyFieldSchema.optional(),
  scope: scopeSchema.optional(),
  periodUnit: periodUnitSchema.optional(),
  periodCount: z.coerce.number().int().min(1).max(24).optional(),
  startDate: isoDate.optional(),
  includeIncome: z.boolean().optional(),
  includeLentBorrowed: z.boolean().optional(),
  includeCategoryIds: z.array(z.string().uuid()).max(50).optional(),
  excludeCategoryIds: z.array(z.string().uuid()).max(50).optional(),
  accountIds: z.array(z.string().uuid()).max(20).optional(),
});

export const listBudgetsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});
