import type { Request, Response } from 'express';
import { env } from '@/app/env';
import { asyncHandler } from '@/middleware/async-handler';
import { OAT_DEMO_USERS, runDemoSeed } from '@/modules/test/demo-seed.service';
import { prisma } from '@/database/prisma';
import { formatDigestMessage } from '@/integrations/telegram/digest-message';
import type { DigestService } from '@/modules/digest/digest.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type { UserRepository } from '@/modules/users/user.repository';
import { NotFoundError, UnauthorizedError } from '@/shared/errors/app-error';
import { ERROR_CODE } from '@/shared/errors/app-error';

export class TestController {
  constructor(
    private readonly digest: DigestService,
    private readonly notifications: NotificationService,
    private readonly users: UserRepository,
  ) {}

  status = asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      data: {
        profile: env.APP_PROFILE,
        devAuthEnabled: env.DEV_AUTH_ENABLED,
        database: env.DATABASE_URL.replace(/:[^:@/]+@/, ':***@'),
        demoUsers: OAT_DEMO_USERS.map((user) => ({
          telegramId: user.telegramId,
          username: user.username,
          firstName: user.firstName,
          devHeader: `x-dev-telegram-id: ${user.telegramId}`,
        })),
      },
    });
  });

  resetDemo = asyncHandler(async (req: Request, res: Response) => {
    const secret = req.header('x-test-secret');
    if (!env.TEST_API_SECRET || secret !== env.TEST_API_SECRET) {
      throw new UnauthorizedError();
    }

    await runDemoSeed(prisma);
    res.json({ data: { ok: true, message: 'OAT demo data reset.' } });
  });

  /**
   * OAT-only: build (and optionally send) the monthly digest for one user by
   * telegram id, so it can be verified without waiting for the cron. Returns the
   * rendered message. `send: true` actually delivers it to the Telegram chat.
   */
  triggerDigest = asyncHandler(async (req: Request, res: Response) => {
    const secret = req.header('x-test-secret');
    if (!env.TEST_API_SECRET || secret !== env.TEST_API_SECRET) {
      throw new UnauthorizedError();
    }

    const telegramId = String(req.body?.telegramId ?? '').trim();
    const send = req.body?.send === true;
    if (!telegramId) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'telegramId is required.');
    }

    const user = await this.users.findByTelegramId(telegramId);
    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'No user for that telegramId.');
    }

    const digest = await this.digest.buildForUser(user.id);
    if (!digest) {
      res.json({ data: { skipped: true, reason: 'No activity for the previous month.' } });
      return;
    }

    const message = formatDigestMessage(digest);
    if (send) {
      await this.notifications.notifyTelegram(user.id, message.title, message.body, {
        parseMode: 'HTML',
      });
    }

    res.json({ data: { skipped: false, sent: send, digest, message } });
  });
}
