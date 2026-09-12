import { config } from '@/app/config';
import { digestQueue } from '@/jobs/queues';
import { logger } from '@/shared/logger/logger';

export const DIGEST_SCHEDULER_ID = 'monthly-digest';

/**
 * Registers (idempotently) the repeatable job that fires the monthly digest
 * fan-out. Safe to call on every worker boot — upsertJobScheduler updates the
 * schedule in place rather than stacking duplicates. No-op when the feature is
 * disabled, and it clears any existing schedule so turning the flag off stops it.
 */
export async function registerMonthlyDigestSchedule(): Promise<void> {
  const { enabled, cron, timezone } = config.jobs.monthlyDigest;

  if (!enabled) {
    await digestQueue.removeJobScheduler(DIGEST_SCHEDULER_ID).catch(() => undefined);
    logger.info('Monthly digest schedule disabled');
    return;
  }

  await digestQueue.upsertJobScheduler(
    DIGEST_SCHEDULER_ID,
    { pattern: cron, tz: timezone },
    { name: 'fanout', data: {} },
  );
  logger.info({ cron, timezone }, 'Monthly digest schedule registered');
}
