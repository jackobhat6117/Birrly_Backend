import type { Queue } from 'bullmq';
import { formatDigestMessage } from '@/integrations/telegram/digest-message';
import type { DigestService } from '@/modules/digest/digest.service';
import type { NotificationService } from '@/modules/notifications/notification.service';
import { logger } from '@/shared/logger/logger';

/**
 * Fan-out step (runs on the monthly cron): enqueue one `send-digest` job per
 * eligible user so each digest is built, retried, and rate-limited on its own —
 * one slow LLM call never blocks the rest.
 */
export async function processDigestFanout(
  digest: DigestService,
  queue: Queue,
): Promise<void> {
  const userIds = await digest.listEligibleUserIds();
  for (const userId of userIds) {
    await queue.add(
      'send-digest',
      { userId },
      // Space calls out a little so a big cohort doesn't hammer the LLM at once.
      { delay: Math.floor(Math.random() * 60_000) },
    );
  }
  logger.info({ count: userIds.length }, 'Monthly digest fan-out enqueued');
}

/** Per-user step: build the digest and push it to the user's Telegram chat. */
export async function processDigestJob(
  userId: string,
  digest: DigestService,
  notifications: NotificationService,
): Promise<void> {
  const payload = await digest.buildForUser(userId);
  if (!payload) {
    logger.info({ userId }, 'Monthly digest skipped (no activity)');
    return;
  }

  const { title, body } = formatDigestMessage(payload);
  await notifications.notifyTelegram(userId, title, body, { parseMode: 'HTML' });
  logger.info({ userId }, 'Monthly digest sent');
}
