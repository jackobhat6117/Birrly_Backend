import { config } from '@/app/config';
import {
  BOT_COMMANDS_AM,
  BOT_COMMANDS_EN,
  BOT_DESCRIPTION_AM,
  BOT_DESCRIPTION_EN,
  BOT_SHORT_DESCRIPTION_AM,
  BOT_SHORT_DESCRIPTION_EN,
} from '@/integrations/telegram/telegram-commands';
import { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import { t } from '@/shared/i18n';
import { logger } from '@/shared/logger/logger';

export function openMiniAppKeyboard(language = 'en') {
  const url = config.telegram.miniAppUrl;
  if (!url) return undefined;
  return {
    inline_keyboard: [[{ text: t(language, 'openAppButton'), web_app: { url } }]],
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

  await bot.setMyCommands(BOT_COMMANDS_EN);
  await bot.setMyCommands(BOT_COMMANDS_AM, 'am');
  await bot.setMyDescription(BOT_DESCRIPTION_EN);
  await bot.setMyDescription(BOT_DESCRIPTION_AM, 'am');
  await bot.setMyShortDescription(BOT_SHORT_DESCRIPTION_EN);
  await bot.setMyShortDescription(BOT_SHORT_DESCRIPTION_AM, 'am');
  logger.info('Telegram bot commands and profile text registered');

  if (miniAppUrl) {
    await bot.setChatMenuButton({
      text: t('en', 'openAppButton'),
      webAppUrl: miniAppUrl,
    });
    logger.info({ miniAppUrl }, 'Telegram menu button configured');
  }
}
