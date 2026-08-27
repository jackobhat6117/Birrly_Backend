import { DateTime } from 'luxon';
import type { AuditService } from '@/modules/audit/audit.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { toReminderDto, type ReminderRepository } from '@/modules/reminders/reminder.repository';
import type { CreateReminderInput, ReminderDto, ReminderScheduler } from '@/modules/reminders/reminder.types';
import { FEATURE, FREE_REMINDER_LIMIT } from '@/shared/constants/features';
import { AppError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import { parseDateInput } from '@/shared/utils/dates';

export class ReminderService {
  constructor(
    private readonly reminders: ReminderRepository,
    private readonly subscriptions: SubscriptionService,
    private readonly audit: AuditService,
    private readonly scheduler: ReminderScheduler,
  ) {}

  async create(userId: string, timezone: string, input: CreateReminderInput): Promise<ReminderDto> {
    const unlimited = await this.subscriptions.canAccess(userId, FEATURE.UNLIMITED_REMINDERS);
    if (!unlimited) {
      const count = await this.reminders.countActive(userId);
      if (count >= FREE_REMINDER_LIMIT) {
        throw new AppError(
          ERROR_CODE.SUBSCRIPTION_REQUIRED,
          'Free plan reminder limit reached.',
          402,
        );
      }
    }

    const runAt = parseDateInput(input.runAt, timezone);
    const created = await this.reminders.create({
      user: { connect: { id: userId } },
      title: input.title.trim(),
      notes: input.notes,
      frequency: input.frequency ?? 'ONCE',
      nextRunAt: runAt,
      debtId: input.debtId,
    });

    await this.scheduler.schedule(created.id, created.nextRunAt);
    await this.audit.record({
      userId,
      action: 'REMINDER_CREATED',
      entityType: 'reminder',
      entityId: created.id,
    });

    return toReminderDto(created);
  }

  async list(userId: string): Promise<ReminderDto[]> {
    const rows = await this.reminders.listForUser(userId);
    return rows.map(toReminderDto);
  }

  async getOwned(id: string, userId: string) {
    const reminder = await this.reminders.findByIdForUser(id, userId);
    if (!reminder) {
      throw new NotFoundError(ERROR_CODE.REMINDER_NOT_FOUND, 'Reminder was not found.');
    }
    return reminder;
  }

  nextRunAt(frequency: CreateReminderInput['frequency'], from: Date): Date | null {
    const current = DateTime.fromJSDate(from, { zone: 'utc' });
    switch (frequency) {
      case 'DAILY':
        return current.plus({ days: 1 }).toJSDate();
      case 'WEEKLY':
        return current.plus({ weeks: 1 }).toJSDate();
      case 'MONTHLY':
        return current.plus({ months: 1 }).toJSDate();
      default:
        return null;
    }
  }
}
