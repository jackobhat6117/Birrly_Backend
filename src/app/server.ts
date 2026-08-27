import { createApp } from '@/app/app';
import { prisma } from '@/database/prisma';
import { queueRedis, redis } from '@/database/redis';
import { logger } from '@/shared/logger/logger';
import { env } from '@/app/env';

const { app } = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'API server started');
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
