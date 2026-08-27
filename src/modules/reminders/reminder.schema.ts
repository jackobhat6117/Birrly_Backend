import { z } from 'zod';

export const createReminderSchema = z.object({
  title: z.string().min(1).max(160),
  notes: z.string().max(500).optional(),
  frequency: z.enum(['ONCE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional().default('ONCE'),
  runAt: z.string().min(1),
  debtId: z.string().uuid().optional(),
});
