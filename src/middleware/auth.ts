import type { RequestHandler } from 'express';
import { config } from '@/app/config';
import { verifyTelegramInitData } from '@/integrations/telegram/telegram-auth';
import type { UserService } from '@/modules/users/user.service';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logger/logger';

export function createAuthMiddleware(users: UserService): RequestHandler {
  return async (req, _res, next) => {
    if (req.method === 'OPTIONS') {
      next();
      return;
    }

    try {
      const initData =
        req.header('x-telegram-init-data') ??
        extractTmaHeader(req.header('authorization'));

      if (initData) {
        const identity = verifyTelegramInitData(initData, config.telegram.botToken);
        req.user = await users.ensureFromTelegram(identity);
        next();
        return;
      }

      if (config.allowsDevAuth) {
        const telegramId = req.header('x-dev-telegram-id');
        if (telegramId) {
          logger.warn({ telegramId }, 'Using development authentication bypass');
          req.user = await users.ensureFromTelegram({ telegramId });
          next();
          return;
        }
      }

      next(new UnauthorizedError());
    } catch (error) {
      next(error);
    }
  };
}

function extractTmaHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const [scheme, value] = header.split(' ');
  if (scheme === 'tma' && value) {
    return value;
  }
  return undefined;
}
