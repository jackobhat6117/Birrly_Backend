import pino from 'pino';
import { env } from '@/app/env';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'pfa-backend' },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-telegram-init-data"]',
      'req.headers["x-telegram-bot-api-secret-token"]',
      'token',
      'botToken',
      'password',
      'secret',
    ],
    remove: true,
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard' },
        }
      : undefined,
});
