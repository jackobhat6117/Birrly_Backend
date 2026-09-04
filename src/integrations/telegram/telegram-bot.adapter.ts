import { env } from '@/app/env';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';
import { logger } from '@/shared/logger/logger';

type TelegramSendMessageInput = {
  chatId: number | string;
  text: string;
  replyMarkup?: unknown;
  parseMode?: 'HTML' | 'MarkdownV2';
};

export class TelegramBotAdapter {
  constructor(private readonly botToken: string) {}

  isConfigured(): boolean {
    return this.botToken.length > 0;
  }

  async sendMessage(input: TelegramSendMessageInput): Promise<void> {
    await this.call('sendMessage', {
      chat_id: input.chatId,
      text: input.text,
      parse_mode: input.parseMode,
      reply_markup: input.replyMarkup,
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      text,
    });
  }

  async setWebhook(input: { url: string; secretToken?: string }): Promise<void> {
    await this.call('setWebhook', {
      url: input.url,
      secret_token: input.secretToken,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    });
  }

  async setChatMenuButton(input: { text: string; webAppUrl: string }): Promise<void> {
    await this.call('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: input.text,
        web_app: { url: input.webAppUrl },
      },
    });
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<void> {
    if (!this.isConfigured()) {
      logger.warn({ method }, 'Telegram bot token is not configured');
      throw new AppError(ERROR_CODE.INTERNAL, 'Telegram is not configured.', 503);
    }

    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = (await response.json()) as { ok: boolean; description?: string };
    if (!body.ok) {
      logger.error({ method, description: body.description }, 'Telegram API call failed');
      throw new AppError(ERROR_CODE.INTERNAL, 'Failed to send Telegram message.', 502);
    }
  }
}

export const telegramBotAdapter = new TelegramBotAdapter(env.TELEGRAM_BOT_TOKEN);
