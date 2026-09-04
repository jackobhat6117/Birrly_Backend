import { config } from '@/app/config';
import { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import { logger } from '@/shared/logger/logger';

export function openMiniAppKeyboard() {
  const url = config.telegram.miniAppUrl;
  if (!url) return undefined;
  return {
    inline_keyboard: [[{ text: 'Open Birrly', web_app: { url } }]],
  };
}

export async function bootstrapTelegramBot(): Promise<void> {
  const { botToken, webhookUrl, webhookSecret, miniAppUrl } = config.telegram;
  if (!botToken) {
    logger.warn('TELEGRAM_BOT_TOKEN is empty — chat bot is disabled');
    return;
  }

  const bot = new TelegramBotAdapter(botToken);

  if (webhookUrl) {
    if (!webhookSecret) {
      logger.warn('TELEGRAM_WEBHOOK_SECRET is empty — webhook will reject Telegram updates');
    }
    await bot.setWebhook({
      url: webhookUrl,
      secretToken: webhookSecret || undefined,
    });
    logger.info({ webhookUrl }, 'Telegram webhook registered');
  } else {
    logger.warn('TELEGRAM_WEBHOOK_URL is empty — register webhook manually or set it in .env');
  }

  if (miniAppUrl) {
    await bot.setChatMenuButton({
      text: 'Open Birrly',
      webAppUrl: miniAppUrl,
    });
    logger.info({ miniAppUrl }, 'Telegram menu button configured');
  }
}
