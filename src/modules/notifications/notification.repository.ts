import type { Notification } from '@prisma/client';
import type { DbClient } from '@/database/prisma';

export class NotificationRepository {
  constructor(private readonly db: DbClient) {}

  async create(data: {
    userId: string;
    title: string;
    body: string;
    reminderId?: string;
  }): Promise<Notification> {
    return this.db.notification.create({
      data: {
        userId: data.userId,
        title: data.title,
        body: data.body,
        reminderId: data.reminderId,
        channel: 'TELEGRAM',
        status: 'PENDING',
      },
    });
  }

  async markSent(id: string): Promise<void> {
    await this.db.notification.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date(), error: null },
    });
  }

  async markFailed(id: string, error: string): Promise<void> {
    await this.db.notification.update({
      where: { id },
      data: { status: 'FAILED', error },
    });
  }
}
