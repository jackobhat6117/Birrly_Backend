import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(['EXPENSE', 'INCOME', 'BOTH']).default('EXPENSE'),
});
