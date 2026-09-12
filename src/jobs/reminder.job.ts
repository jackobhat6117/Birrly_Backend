import { formatReminderMessage, helpKeyboard } from '@/integrations/telegram/telegram-ui';
import type { NotificationService } from '@/modules/notifications/notification.service';
import type { ReminderRepository } from '@/modules/reminders/reminder.repository';
import type { ReminderService } from '@/modules/reminders/reminder.service';
import type { ReminderScheduler } from '@/modules/reminders/reminder.types';
import type { UserRepository } from '@/modules/users/user.repository';
import { config } from '@/app/config';
import { logger } from '@/shared/logger/logger';

export async function processReminderJob(
  reminderId: string,
  reminders: ReminderRepository,
  reminderService: ReminderService,
  notifications: NotificationService,
  scheduler: ReminderScheduler,
  users: UserRepository,
): Promise<void> {
  const reminder = await reminders.findById(reminderId);
  if (!reminder || reminder.status !== 'ACTIVE') {
    return;
  }

  // Localize to the user's language and include their notes; fall back to the
  // app default language if the user row can't be loaded for some reason.
  const user = await users.findById(reminder.userId);
  const language = user?.language ?? config.defaults.language;
  const { title, body } = formatReminderMessage(language, reminder.title, reminder.notes);

  await notifications.notifyTelegram(reminder.userId, title, body, {
    reminderId: reminder.id,
    parseMode: 'HTML',
    replyMarkup: helpKeyboard(language),
  });

  const nextRun = reminderService.nextRunAt(reminder.frequency, reminder.nextRunAt);
  if (!nextRun) {
    await reminders.update(reminder.id, { status: 'COMPLETED' });
    return;
  }

  await reminders.update(reminder.id, { nextRunAt: nextRun });
  await scheduler.schedule(reminder.id, nextRun);
  logger.info({ reminderId: reminder.id }, 'Reminder processed');
}
