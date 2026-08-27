import type { Request, Response } from 'express';
import { env } from '@/app/env';
import { asyncHandler } from '@/middleware/async-handler';
import type { TelegramIdempotencyStore } from '@/integrations/telegram/telegram-idempotency.store';
import type { TelegramUpdateHandler } from '@/integrations/telegram/telegram-update.handler';
import type { TelegramUpdate } from '@/integrations/telegram/telegram.types';
import { UnauthorizedError } from '@/shared/errors/app-error';
import { logger } from '@/shared/logger/logger';

export class TelegramWebhookController {
  constructor(
    private readonly handler: TelegramUpdateHandler,
    private readonly idempotency: TelegramIdempotencyStore,
  ) {}

  receive = asyncHandler(async (req: Request, res: Response) => {
    const secret = req.header('x-telegram-bot-api-secret-token');
    if (env.TELEGRAM_WEBHOOK_SECRET && secret !== env.TELEGRAM_WEBHOOK_SECRET) {
      throw new UnauthorizedError();
    }

    const update = req.body as TelegramUpdate;
    if (!update?.update_id) {
      res.status(200).json({ data: { ok: true } });
      return;
    }

    const claimed = await this.idempotency.claim(update.update_id);
    if (!claimed) {
      res.status(200).json({ data: { ok: true, duplicate: true } });
      return;
    }

    try {
      await this.handler.handle(update);
    } catch (error) {
      logger.error({ err: error, updateId: update.update_id }, 'Telegram update failed');
    }

    res.status(200).json({ data: { ok: true } });
  });
}
