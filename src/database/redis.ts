import Redis from 'ioredis';
import { env } from '@/app/env';

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
  queueRedis?: Redis;
};

function createRedis(connectionName: string): Redis {
  return new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName,
  });
}

export const redis = globalForRedis.redis ?? createRedis('pfa-api');
export const queueRedis = globalForRedis.queueRedis ?? createRedis('pfa-queue');

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
  globalForRedis.queueRedis = queueRedis;
}

export async function pingRedis(): Promise<boolean> {
  try {
    const response = await redis.ping();
    return response === 'PONG';
  } catch {
    return false;
  }
}
