import { Queue } from 'bullmq';
import { queueRedis } from '@/database/redis';

export const QUEUE = {
  reminders: 'reminders',
  notifications: 'notifications',
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
