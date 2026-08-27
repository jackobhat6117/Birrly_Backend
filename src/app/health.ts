import type { Request, Response } from 'express';
import { prisma } from '@/database/prisma';
import { pingRedis } from '@/database/redis';
import { asyncHandler } from '@/middleware/async-handler';

export const health = asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: { status: 'ok' } });
});

export const ready = asyncHandler(async (_req: Request, res: Response) => {
  const [database, cache] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    pingRedis(),
  ]);

  const readyState = database && cache;
  res.status(readyState ? 200 : 503).json({
    data: {
      status: readyState ? 'ready' : 'degraded',
      checks: { database, redis: cache },
    },
  });
});
