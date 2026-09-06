import { z } from 'zod';
import { isoDateSchema, moneyFieldSchema } from '@/shared/utils/validation';

// Telegram's own rules: 5–32 chars, letters/digits/underscore, must start with
// a letter. We accept a leading "@" for humans and strip it before storage.
const telegramUsernameSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@/, ''))
  .refine((value) => /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(value), {
    message: 'Telegram username must be 5–32 letters, digits or underscores and start with a letter.',
  });

export const createDebtSchema = z.object({
  personName: z.string().min(1).max(80),
  personTelegramUsername: telegramUsernameSchema.optional(),
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
