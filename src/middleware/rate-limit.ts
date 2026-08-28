import type { RequestHandler } from 'express';
import { env } from '@/app/env';
import { redis } from '@/database/redis';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';

type RateLimitOptions = {
  prefix: string;
  windowMs?: number;
  max?: number;
};

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    work,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('redis timeout')), timeoutMs);
    }),
  ]);
}

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const windowMs = options.windowMs ?? env.RATE_LIMIT_WINDOW_MS;
  const max = options.max ?? env.RATE_LIMIT_MAX;

  return async (req, res, next) => {
    try {
      const identity = req.user?.id ?? req.ip ?? 'anonymous';
      const key = `ratelimit:${options.prefix}:${identity}`;
      const current = await withTimeout(redis.incr(key), 400);
      if (current === 1) {
        await withTimeout(redis.pexpire(key, windowMs), 400);
      }

      res.setHeader('x-ratelimit-limit', String(max));
      res.setHeader('x-ratelimit-remaining', String(Math.max(0, max - current)));

      if (current > max) {
        next(new AppError(ERROR_CODE.RATE_LIMITED, 'Too many requests. Please try again later.', 429));
        return;
      }

      next();
    } catch {
      next();
    }
  };
}
