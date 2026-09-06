import { z } from 'zod';
import { isoDateSchema, moneyFieldSchema } from '@/shared/utils/validation';

const telegramUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ''))
  .refine((value) => /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value), {
    message: 'Telegram username must be 5–32 letters, digits or underscores and start with a letter.',
  });

export const createEqubSchema = z.object({
  name: z.string().min(1).max(80),
  contributionAmount: moneyFieldSchema,
  currency: z.string().min(3).max(8).optional(),
  frequency: z.enum(['WEEKLY', 'MONTHLY']),
  startDate: isoDateSchema.optional(),
  members: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        telegramUsername: telegramUsernameSchema.optional(),
      }),
    )
    .min(2, 'An Equb needs at least two members.')
    .max(50, 'An Equb can have at most 50 members.'),
});

export const recordEqubContributionSchema = z.object({
  memberId: z.string().uuid(),
});
