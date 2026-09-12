import { Queue } from 'bullmq';
import { queueRedis } from '@/database/redis';

export const QUEUE = {
  reminders: 'reminders',
  notifications: 'notifications',
  digest: 'digest',
} as const;

export const reminderQueue = new Queue(QUEUE.reminders, {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
});

// Fewer attempts than reminders: a digest is a nice-to-have, and each retry can
// cost a real LLM call. removeOnComplete keeps Redis tidy across a big fan-out.
export const digestQueue = new Queue(QUEUE.digest, {
  connection: queueRedis,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});
