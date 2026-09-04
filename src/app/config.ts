import { env } from '@/app/env';
import { DEFAULT_CURRENCY, DEFAULT_LANGUAGE, DEFAULT_TIMEZONE } from '@/shared/constants/app';

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isDevelopment: env.NODE_ENV === 'development',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  defaults: {
    currency: DEFAULT_CURRENCY,
    timezone: DEFAULT_TIMEZONE,
    language: DEFAULT_LANGUAGE,
  },
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN,
    webhookSecret: env.TELEGRAM_WEBHOOK_SECRET,
    webhookUrl: env.TELEGRAM_WEBHOOK_URL,
    miniAppUrl: env.TELEGRAM_MINI_APP_URL.replace(/\/$/, '') || '',
  },
  llm: {
    provider: env.LLM_PROVIDER,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
  },
  corsOrigins: env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [],
  admin: {
    jwtSecret: env.ADMIN_JWT_SECRET,
    jwtExpiresSec: env.ADMIN_JWT_EXPIRES_SEC,
    bootstrapEmail: env.ADMIN_BOOTSTRAP_EMAIL.trim().toLowerCase(),
    bootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD,
  },
} as const;
