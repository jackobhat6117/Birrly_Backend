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
  TELEGRAM_MINI_APP_URL: z.string().default(''),
  LLM_API_KEY: z.string().default(''),
  LLM_PROVIDER: z.enum(['disabled', 'gemini', 'openai', 'anthropic']).default('gemini'),
  LLM_MODEL: z.string().default('gemini-2.0-flash'),
  DEV_AUTH_ENABLED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  APP_PROFILE: z.enum(['production', 'oat']).default('production'),
  RUN_DEMO_SEED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  ALLOW_DEMO_SEED: z
    .string()
    .default('false')
    .transform((value) => value === 'true'),
  TEST_API_SECRET: z.string().default(''),
  CORS_ORIGIN: z.string().default(''),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  ADMIN_JWT_SECRET: z.string().min(1).default('dev-admin-jwt-secret-change-me'),
  ADMIN_JWT_EXPIRES_SEC: z.coerce.number().int().positive().default(86_400),
  ADMIN_BOOTSTRAP_EMAIL: z.string().default(''),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.DEV_AUTH_ENABLED && parsed.data.APP_PROFILE !== 'oat') {
  throw new Error('DEV_AUTH_ENABLED must not be true in production (except APP_PROFILE=oat).');
}

if (parsed.data.APP_PROFILE === 'production' && parsed.data.ALLOW_DEMO_SEED) {
  throw new Error('ALLOW_DEMO_SEED must not be true when APP_PROFILE=production.');
}

if (parsed.data.APP_PROFILE === 'production' && parsed.data.RUN_DEMO_SEED) {
  throw new Error('RUN_DEMO_SEED must not be true when APP_PROFILE=production.');
}

if (parsed.data.APP_PROFILE === 'oat' && parsed.data.RUN_DEMO_SEED && !parsed.data.ALLOW_DEMO_SEED) {
  throw new Error('RUN_DEMO_SEED requires ALLOW_DEMO_SEED=true on APP_PROFILE=oat.');
}

if (
  parsed.data.NODE_ENV === 'production' &&
  parsed.data.ADMIN_JWT_SECRET === 'dev-admin-jwt-secret-change-me'
) {
  throw new Error('ADMIN_JWT_SECRET must be set in production.');
}

export const env = parsed.data;
export type Env = typeof env;
