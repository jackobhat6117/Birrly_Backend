import type { Prisma, Reminder } from '@prisma/client';
import type { DbClient } from '@/database/prisma';
import type { ReminderDto } from '@/modules/reminders/reminder.types';

export class ReminderRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: Prisma.ReminderCreateInput): Promise<Reminder> {
    return this.db.reminder.create({ data });
  }

  async findByIdForUser(id: string, userId: string): Promise<Reminder | null> {
    return this.db.reminder.findFirst({ where: { id, userId } });
  }

  async findById(id: string): Promise<Reminder | null> {
    return this.db.reminder.findUnique({ where: { id } });
  }

  async listForUser(userId: string): Promise<Reminder[]> {
    return this.db.reminder.findMany({
      where: { userId },
      orderBy: { nextRunAt: 'asc' },
    });
  }

  async countActive(userId: string): Promise<number> {
    return this.db.reminder.count({
      where: { userId, status: 'ACTIVE' },
    });
  }

  async update(id: string, data: Prisma.ReminderUpdateInput): Promise<Reminder> {
    return this.db.reminder.update({ where: { id }, data });
  }

  async dueReminders(now: Date, take = 100): Promise<Reminder[]> {
    return this.db.reminder.findMany({
      where: { status: 'ACTIVE', nextRunAt: { lte: now } },
      take,
    });
  }
}

export function toReminderDto(row: Reminder): ReminderDto {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    frequency: row.frequency,
    nextRunAt: row.nextRunAt.toISOString(),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}
