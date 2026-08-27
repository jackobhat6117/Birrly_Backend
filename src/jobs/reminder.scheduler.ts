import { reminderQueue } from '@/jobs/queues';
import type { ReminderScheduler } from '@/modules/reminders/reminder.types';

export class BullmqReminderScheduler implements ReminderScheduler {
  async schedule(reminderId: string, runAt: Date): Promise<void> {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    await reminderQueue.add(
      'send-reminder',
      { reminderId },
      {
        jobId: `reminder:${reminderId}:${runAt.getTime()}`,
        delay,
      },
    );
  }
}
