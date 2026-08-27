import { Worker } from 'bullmq';
import { createContainer } from '@/app/container';
import { queueRedis } from '@/database/redis';
import { QUEUE } from '@/jobs/queues';
import { processReminderJob } from '@/jobs/reminder.job';
import { logger } from '@/shared/logger/logger';

const container = createContainer();

const worker = new Worker(
  QUEUE.reminders,
  async (job) => {
    const reminderId = job.data.reminderId as string;
    await processReminderJob(
      reminderId,
      container.reminderRepository,
      container.reminderService,
      container.notificationService,
      container.reminderScheduler,
    );
  },
  { connection: queueRedis },
);

worker.on('failed', (job, error) => {
  logger.error({ err: error, jobId: job?.id }, 'Reminder job failed');
});

logger.info('Worker started');

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
