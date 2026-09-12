import { Worker } from 'bullmq';
import { createContainer } from '@/app/container';
import { queueRedis } from '@/database/redis';
import { digestQueue, QUEUE } from '@/jobs/queues';
import { processReminderJob } from '@/jobs/reminder.job';
import { processDigestFanout, processDigestJob } from '@/jobs/digest.job';
import { registerMonthlyDigestSchedule } from '@/jobs/digest.scheduler';
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
      container.userRepository,
    );
  },
  { connection: queueRedis },
);

// Digest worker: the repeatable scheduler emits `fanout`, which enqueues one
// `send-digest` per eligible user; those are processed here too.
const digestWorker = new Worker(
  QUEUE.digest,
  async (job) => {
    if (job.name === 'send-digest') {
      await processDigestJob(job.data.userId as string, container.digestService, container.notificationService);
      return;
    }
    await processDigestFanout(container.digestService, digestQueue);
  },
  { connection: queueRedis },
);

worker.on('failed', (job, error) => {
  logger.error({ err: error, jobId: job?.id }, 'Reminder job failed');
});

digestWorker.on('failed', (job, error) => {
  logger.error({ err: error, jobId: job?.id, name: job?.name }, 'Digest job failed');
});

void registerMonthlyDigestSchedule().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to register monthly digest schedule');
});

logger.info('Worker started');

const shutdown = async () => {
  await worker.close();
  await digestWorker.close();
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown();
});
process.on('SIGINT', () => {
  void shutdown();
});
