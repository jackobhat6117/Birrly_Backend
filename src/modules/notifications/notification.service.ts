import type { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import type { UserRepository } from '@/modules/users/user.repository';
import type { NotificationRepository } from '@/modules/notifications/notification.repository';

export class NotificationService {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly users: UserRepository,
    private readonly telegram: TelegramBotAdapter,
  ) {}

  async notifyTelegram(userId: string, title: string, body: string, reminderId?: string): Promise<void> {
    const notification = await this.notifications.create({
      userId,
      title,
      body,
      reminderId,
    });

    const user = await this.users.findById(userId);
    if (!user) {
      await this.notifications.markFailed(notification.id, 'User not found');
      return;
    }

    try {
      await this.telegram.sendMessage({
        chatId: user.telegramId,
        text: `${title}\n${body}`,
      });
      await this.notifications.markSent(notification.id);
    } catch (error) {
      await this.notifications.markFailed(
        notification.id,
        error instanceof Error ? error.message : 'Telegram send failed',
      );
      throw error;
    }
  }
}
