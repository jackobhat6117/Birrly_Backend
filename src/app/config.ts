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
  },
  llm: {
    provider: env.LLM_PROVIDER,
    apiKey: env.LLM_API_KEY,
    model: env.LLM_MODEL,
  },
  corsOrigins: env.CORS_ORIGIN
    ? env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
    : [],
} as const;
