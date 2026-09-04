import { randomBytes } from 'node:crypto';
import type { AiInterpreter } from '@/modules/ai/ai.interpreter';
import type { DebtService } from '@/modules/debts/debt.service';
import type { ReminderService } from '@/modules/reminders/reminder.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { TransactionService } from '@/modules/transactions/transaction.service';
import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { UserService } from '@/modules/users/user.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import type { FeedbackService } from '@/modules/feedback/feedback.service';
import { openMiniAppKeyboard } from '@/integrations/telegram/telegram-bootstrap';
import { FEATURE } from '@/shared/constants/features';
import type { StructuredCommand } from '@/modules/ai/ai.types';
import type { ConversationStore } from '@/integrations/telegram/conversation.store';
import type { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import type { TelegramUpdate } from '@/integrations/telegram/telegram.types';
import { t } from '@/shared/i18n';
import { logger } from '@/shared/logger/logger';
import { formatMoney } from '@/shared/utils/money';

export class TelegramUpdateHandler {
  constructor(
    private readonly users: UserService,
    private readonly interpreter: AiInterpreter,
    private readonly transactions: TransactionService,
    private readonly debts: DebtService,
    private readonly reminders: ReminderService,
    private readonly reports: ReportService,
    private readonly conversations: ConversationStore,
    private readonly telegram: TelegramBotAdapter,
    private readonly subscriptions: SubscriptionService,
    private readonly feedback: FeedbackService,
  ) {}

  async handle(update: TelegramUpdate): Promise<void> {
    if (update.callback_query) {
      await this.handleCallback(update);
      return;
    }

    const message = update.message;
    if (!message?.from || !message.text) {
      return;
    }

    const user = await this.users.ensureFromTelegram({
      telegramId: String(message.from.id),
      username: message.from.username,
      firstName: message.from.first_name,
      lastName: message.from.last_name,
      languageCode: message.from.language_code,
    });

    const text = message.text.trim();
    if (text.startsWith('/start')) {
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: t(user.language, 'welcome'),
        replyMarkup: openMiniAppKeyboard(),
      });
      return;
    }

    if (text.startsWith('/help')) {
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: t(user.language, 'help'),
      });
      return;
    }

    if (text.startsWith('/feedback')) {
      const body = text.replace(/^\/feedback(?:@\S+)?\s*/i, '').trim();
      if (!body) {
        await this.telegram.sendMessage({
          chatId: message.chat.id,
          text: t(user.language, 'feedbackPrompt'),
        });
        return;
      }

      await this.feedback.create(user.id, { message: body, category: 'OTHER' }, 'BOT');
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: t(user.language, 'feedbackReceived'),
      });
      return;
    }

    if (text.startsWith('/dashboard')) {
      const dashboard = await this.reports.dashboard(user.id, user.timezone);
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: [
          'This month',
          `Income ${dashboard.income} ${user.currency}`,
          `Expenses ${dashboard.expenses} ${user.currency}`,
          `Remaining ${dashboard.remaining} ${user.currency}`,
        ].join('\n'),
      });
      return;
    }

    const allowLlm = await this.subscriptions.canAccess(user.id, FEATURE.AI_NATURAL_LANGUAGE);
    const command = await this.interpreter.interpret(
      {
        text,
        language: user.language,
        currency: user.currency,
      },
      { allowLlm },
    );

    if (command.intent === 'UNKNOWN') {
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: t(user.language, 'unrecognized'),
      });
      return;
    }

    if (command.missingFields.includes('categorySlug')) {
      await this.telegram.sendMessage({
        chatId: message.chat.id,
        text: t(user.language, 'askCategory', {
          amount: command.amount ?? '',
          currency: user.currency,
        }),
      });
      return;
    }

    if (command.intent.startsWith('QUERY_')) {
      await this.handleQuery(message.chat.id, user, command);
      return;
    }

    const token = randomBytes(6).toString('hex');
    await this.conversations.save(user.id, {
      token,
      command,
      createdAt: new Date().toISOString(),
    });

    await this.telegram.sendMessage({
      chatId: message.chat.id,
      text: this.confirmText(user, command),
      replyMarkup: {
        inline_keyboard: [
          [
            { text: 'Confirm', callback_data: `ok:${token}` },
            { text: 'Cancel', callback_data: `no:${token}` },
          ],
        ],
      },
    });
  }

  private async handleCallback(update: TelegramUpdate): Promise<void> {
    const callback = update.callback_query;
    if (!callback?.data || !callback.from || !callback.message) {
      return;
    }

    const [action, token] = callback.data.split(':');
    if (!token || (action !== 'ok' && action !== 'no')) {
      return;
    }

    const user = await this.users.ensureFromTelegram({
      telegramId: String(callback.from.id),
      username: callback.from.username,
      firstName: callback.from.first_name,
      lastName: callback.from.last_name,
      languageCode: callback.from.language_code,
    });

    const pending = await this.conversations.get(user.id);
    if (!pending || pending.token !== token) {
      await this.telegram.answerCallbackQuery(callback.id, 'This confirmation expired.');
      return;
    }

    if (action === 'no') {
      await this.conversations.clear(user.id);
      await this.telegram.answerCallbackQuery(callback.id, 'Cancelled');
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: t(user.language, 'cancelled'),
      });
      return;
    }

    try {
      const confirmation = await this.commit(user, pending.command);
      await this.conversations.clear(user.id);
      await this.telegram.answerCallbackQuery(callback.id, 'Saved');
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: confirmation,
      });
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Failed to commit Telegram command');
      await this.telegram.answerCallbackQuery(callback.id, 'Could not save');
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: t(user.language, 'internalError'),
      });
    }
  }

  private async commit(user: AuthenticatedUser, command: StructuredCommand): Promise<string> {
    const idempotencyKey = `telegram:${command.intent}:${command.amount}:${command.categorySlug}:${command.personName}:${command.date}:${command.reminderTitle}`;

    if (command.intent === 'CREATE_EXPENSE' || command.intent === 'CREATE_INCOME') {
      const saved = await this.transactions.create(user.id, user.currency, user.timezone, {
        type: command.intent === 'CREATE_EXPENSE' ? 'EXPENSE' : 'INCOME',
        amount: command.amount ?? '0',
        categorySlug: command.categorySlug,
        description: command.description,
        transactionDate: command.date,
        source: 'TELEGRAM',
        idempotencyKey,
      });
      return t(
        user.language,
        command.intent === 'CREATE_EXPENSE' ? 'recordedExpense' : 'recordedIncome',
        {
          amount: saved.amount,
          currency: saved.currency,
          category: command.categorySlug ?? '',
        },
      );
    }

    if (command.intent === 'CREATE_DEBT') {
      const saved = await this.debts.create(user.id, user.currency, user.timezone, {
        personName: command.personName ?? 'Unknown',
        type: command.debtType ?? 'OWED_TO_ME',
        amount: command.amount ?? '0',
      });
      return t(user.language, 'recordedDebt', {
        person: saved.personName,
        amount: saved.originalAmount,
        currency: saved.currency,
      });
    }

    if (command.intent === 'CREATE_REMINDER') {
      await this.reminders.create(user.id, user.timezone, {
        title: command.reminderTitle ?? 'Reminder',
        runAt: command.date ?? 'today',
      });
      return t(user.language, 'recordedReminder');
    }

    return t(user.language, 'unrecognized');
  }

  private async handleQuery(chatId: number, user: AuthenticatedUser, command: StructuredCommand): Promise<void> {
    if (command.intent === 'QUERY_DEBT') {
      const debts = await this.debts.list(user.id);
      const open = debts.filter((debt) => debt.status !== 'SETTLED');
      const lines = open.length
        ? open.map((debt) => `${debt.personName}: ${debt.remainingAmount} ${debt.currency}`)
        : ['No open debts.'];
      await this.telegram.sendMessage({ chatId, text: lines.join('\n') });
      return;
    }

    const dashboard = await this.reports.dashboard(user.id, user.timezone);
    await this.telegram.sendMessage({
      chatId,
      text: `Income ${dashboard.income} ${user.currency}\nExpenses ${dashboard.expenses} ${user.currency}\nRemaining ${dashboard.remaining} ${user.currency}`,
    });
  }

  private confirmText(user: AuthenticatedUser, command: StructuredCommand): string {
    const amount = command.amount ? formatMoney(command.amount) : '';
    if (command.intent === 'CREATE_EXPENSE') {
      return t(user.language, 'confirmExpense', {
        amount,
        currency: user.currency,
        category: command.categorySlug ?? command.description ?? '',
      });
    }
    if (command.intent === 'CREATE_INCOME') {
      return t(user.language, 'confirmIncome', {
        amount,
        currency: user.currency,
        category: command.categorySlug ?? '',
      });
    }
    if (command.intent === 'CREATE_DEBT') {
      return t(user.language, 'confirmDebt', {
        person: command.personName ?? '',
        amount,
        currency: user.currency,
      });
    }
    return t(user.language, 'confirmReminder', {
      title: command.reminderTitle ?? '',
      date: command.date ?? '',
    });
  }
}
