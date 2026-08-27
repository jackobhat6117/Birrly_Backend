import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DATABASE_URL: z
    .string()
    .min(1)
    .default('postgresql://pfa:pfa@localhost:5432/pfa?schema=public'),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  TELEGRAM_WEBHOOK_URL: z.string().default(''),
  LLM_API_KEY: z.string().default(''),
  LLM_PROVIDER: z.enum(['disabled', 'openai', 'anthropic']).default('disabled'),
  LLM_MODEL: z.string().default(''),
  DEV_AUTH_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  CORS_ORIGIN: z.string().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.DEV_AUTH_ENABLED) {
  throw new Error('DEV_AUTH_ENABLED must not be true in production.');
}

export const env = parsed.data;
export type Env = typeof env;
