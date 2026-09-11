import { createApp } from '@/app/app';
import { prisma } from '@/database/prisma';
import { queueRedis, redis } from '@/database/redis';
import { bootstrapTelegramBot } from '@/integrations/telegram/telegram-bootstrap';
import { logger } from '@/shared/logger/logger';
import { env } from '@/app/env';

const { app, container } = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API server started');
  void container.adminService.bootstrap().catch((error: unknown) => {
    logger.error({ err: error }, 'Admin bootstrap failed');
  });
  void bootstrapTelegramBot().catch((error: unknown) => {
    logger.error({ err: error }, 'Telegram bootstrap failed');
  });
  // Liveness probe: one real LLM call on boot so the logs say plainly whether AI
  // chat is actually working (not just configured). A failure here is why users
  // would fall back to the rule parser — surfaced instead of hidden.
  void container.aiHealthService
    .probe()
    .then((result) => {
      if (result.ok) {
        logger.info(
          { provider: result.provider, model: result.model, latencyMs: result.latencyMs },
          '✅ LLM alive — AI natural-language chat is ON',
        );
      } else {
        logger.warn(
          { provider: result.provider, model: result.model, enabled: result.enabled, error: result.error },
          '⚠️ LLM NOT alive — running rule-based parser only (users will not get AI chat)',
        );
      }
    })
    .catch((error: unknown) => {
      logger.warn({ err: error }, 'LLM startup probe failed');
    });
});

const shutdown = async (signal: string) => {
  logger.info({ signal }, 'Shutting down');
  server.close(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    queueRedis.disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
});
