import type { Request, Response } from 'express';
import { env } from '@/app/env';
import { asyncHandler } from '@/middleware/async-handler';
import { OAT_DEMO_USERS, runDemoSeed } from '@/modules/test/demo-seed.service';
import { prisma } from '@/database/prisma';
import { UnauthorizedError } from '@/shared/errors/app-error';

export class TestController {
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
}
