import type { Request, Response } from 'express';
import { config } from '@/app/config';
import { prisma } from '@/database/prisma';
import { pingRedis } from '@/database/redis';
import { asyncHandler } from '@/middleware/async-handler';

export const health = asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    data: {
      status: 'ok',
      profile: config.appProfile,
    },
  });
});

export const ready = asyncHandler(async (_req: Request, res: Response) => {
  const [database, cache] = await Promise.all([
    prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
    pingRedis(),
  ]);

  const readyState = database && cache;
  // Config-level only (no LLM call, no secret): a quick "is AI wired up?" signal.
  // The live probe lives behind admin auth at GET /api/v1/admin/ai/health?probe=true.
  const llmEnabled = config.llm.provider !== 'disabled' && config.llm.apiKey.trim().length > 0;
  res.status(readyState ? 200 : 503).json({
    data: {
      status: readyState ? 'ready' : 'degraded',
      checks: { database, redis: cache },
      llm: { enabled: llmEnabled, provider: config.llm.provider },
    },
  });
});
