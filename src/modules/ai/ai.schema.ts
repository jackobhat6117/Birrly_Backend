import { z } from 'zod';

export const structuredCommandSchema = z.object({
  intent: z.enum([
    'CREATE_EXPENSE',
    'CREATE_INCOME',
    'CREATE_DEBT',
    'RECORD_DEBT_PAYMENT',
    'CREATE_REMINDER',
    'CREATE_BUDGET',
    'CREATE_SAVINGS_GOAL',
    'QUERY_SPENDING',
    'QUERY_BALANCE',
    'QUERY_DEBT',
    'QUERY_REPORT',
    'UNKNOWN',
  ]),
  amount: z.string().optional(),
  currency: z.string().optional(),
  categorySlug: z.string().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
  personName: z.string().optional(),
  debtType: z.enum(['OWED_TO_ME', 'I_OWE']).optional(),
  reminderTitle: z.string().optional(),
  confidence: z.number().min(0).max(1),
  missingFields: z.array(z.string()),
  source: z.enum(['llm', 'fallback']),
});
