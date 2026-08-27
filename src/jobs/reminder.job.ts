import type { NotificationService } from '@/modules/notifications/notification.service';
import type { ReminderRepository } from '@/modules/reminders/reminder.repository';
import type { ReminderService } from '@/modules/reminders/reminder.service';
import type { ReminderScheduler } from '@/modules/reminders/reminder.types';
import { logger } from '@/shared/logger/logger';

export async function processReminderJob(
  reminderId: string,
  reminders: ReminderRepository,
  reminderService: ReminderService,
  notifications: NotificationService,
  scheduler: ReminderScheduler,
): Promise<void> {
  const reminder = await reminders.findById(reminderId);
  if (!reminder || reminder.status !== 'ACTIVE') {
    return;
  }

  await notifications.notifyTelegram(
    reminder.userId,
    'Reminder',
    reminder.title,
    reminder.id,
  );

  const nextRun = reminderService.nextRunAt(reminder.frequency, reminder.nextRunAt);
  if (!nextRun) {
    await reminders.update(reminder.id, { status: 'COMPLETED' });
    return;
  }

  await reminders.update(reminder.id, { nextRunAt: nextRun });
  await scheduler.schedule(reminder.id, nextRun);
  logger.info({ reminderId: reminder.id }, 'Reminder processed');
}
