import { randomBytes } from 'node:crypto';
import type { AiParseService } from '@/modules/ai/ai-parse.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { CategoryService } from '@/modules/categories/category.service';
import type { DebtService } from '@/modules/debts/debt.service';
import type { EqubService } from '@/modules/equb/equb.service';
import type { ReminderService } from '@/modules/reminders/reminder.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { SavingsService } from '@/modules/savings/savings.service';
import type { TransactionService } from '@/modules/transactions/transaction.service';
import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { UserService } from '@/modules/users/user.service';
import type { FeedbackService } from '@/modules/feedback/feedback.service';
import type { StructuredCommand } from '@/modules/ai/ai.types';
import type { ConversationStore } from '@/integrations/telegram/conversation.store';
import type { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import type { TelegramUpdate } from '@/integrations/telegram/telegram.types';
import {
  confirmKeyboard,
  escapeHtml,
  formatBalanceMessage,
  formatDashboardMessage,
  formatDebtsMessage,
  formatSpendingMessage,
  helpKeyboard,
  htmlConfirmText,
  parseSlashCommand,
  startKeyboard,
} from '@/integrations/telegram/telegram-ui';
import { buildHelpfulNudge } from '@/integrations/telegram/nudge-message';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';
import { t } from '@/shared/i18n';
import { logger } from '@/shared/logger/logger';
import { formatMoney } from '@/shared/utils/money';

export class TelegramUpdateHandler {
  constructor(
    private readonly users: UserService,
    private readonly aiParse: AiParseService,
    private readonly transactions: TransactionService,
    private readonly debts: DebtService,
    private readonly equbs: EqubService,
    private readonly reminders: ReminderService,
    private readonly reports: ReportService,
    private readonly budgets: BudgetService,
    private readonly savings: SavingsService,
    private readonly categories: CategoryService,
    private readonly conversations: ConversationStore,
    private readonly telegram: TelegramBotAdapter,
    private readonly feedback: FeedbackService,
    private readonly freeAiDailyLimit: number,
  ) {}

  async handle(update: TelegramUpdate): Promise<void> {
    const chatId = this.resolveChatId(update);
    let language = 'en';

    try {
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
      language = user.language;

      const slash = parseSlashCommand(message.text);
      if (slash) {
        await this.handleSlashCommand(message.chat.id, user, slash.command, slash.args);
        return;
      }

      await this.handleNaturalLanguage(message.chat.id, user, message.text.trim());
    } catch (error) {
      logger.error({ err: error, updateId: update.update_id, chatId }, 'Telegram handler failed');
      if (chatId) {
        await this.telegram.sendMessage({
          chatId,
          text: t(language, 'internalError'),
          parseMode: 'HTML',
        });
      }
    }
  }

  private resolveChatId(update: TelegramUpdate): number | undefined {
    return update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  }

  private async handleSlashCommand(
    chatId: number,
    user: AuthenticatedUser,
    command: string,
    args: string,
  ): Promise<void> {
    switch (command) {
      case 'start':
        // Deep link: /start equb-<token> lands a member on the join flow.
        if (args.startsWith('equb-')) {
          await this.handleEqubJoin(chatId, user, args.slice('equb-'.length));
          return;
        }
        await this.sendWelcome(chatId, user);
        return;
      case 'help':
        await this.sendHelp(chatId, user);
        return;
      case 'dashboard':
        await this.sendDashboard(chatId, user);
        return;
      case 'feedback':
        await this.handleFeedback(chatId, user, args);
        return;
      default:
        await this.sendNudge(chatId, user);
    }
  }

  private async sendNudge(chatId: number, user: AuthenticatedUser, text = ''): Promise<void> {
    await this.telegram.sendMessage({
      chatId,
      text: buildHelpfulNudge(user.language, text),
      parseMode: 'HTML',
      replyMarkup: startKeyboard(user.language),
    });
  }

  private async handleNaturalLanguage(
    chatId: number,
    user: AuthenticatedUser,
    text: string,
  ): Promise<void> {
    const parsed = await this.aiParse.parseForUser(user.id, {
      text,
      language: user.language,
      currency: user.currency,
    });

    if (parsed.quotaExceeded) {
      await this.telegram.sendMessage({
        chatId,
        text: `${t(user.language, 'aiQuotaExceeded', {
          limit: parsed.usage.limit,
        })}\n\n${buildHelpfulNudge(user.language, text, true)}`,
        parseMode: 'HTML',
        replyMarkup: startKeyboard(user.language),
      });
      return;
    }

    const command = parsed.command;

    if (command.intent === 'UNKNOWN') {
      await this.sendNudge(chatId, user, text);
      return;
    }

    if (command.intent === 'GREET') {
      await this.sendGreeting(chatId, user);
      return;
    }

    if (command.intent === 'WELLBEING') {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'wellbeingReply'),
        parseMode: 'HTML',
        replyMarkup: startKeyboard(user.language),
      });
      return;
    }

    if (command.intent === 'THANKS') {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'thanksReply'),
        parseMode: 'HTML',
        replyMarkup: helpKeyboard(user.language),
      });
      return;
    }

    if (command.intent.startsWith('QUERY_')) {
      await this.handleQuery(chatId, user, command);
      return;
    }

    const missingReply = this.missingFieldReply(user, command);
    if (missingReply) {
      await this.telegram.sendMessage({
        chatId,
        text: missingReply,
        parseMode: 'HTML',
      });
      return;
    }

    if (command.intent === 'RECORD_DEBT_PAYMENT') {
      const debt = await this.findOpenDebt(user.id, command.personName ?? '');
      if (!debt) {
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'debtNotFound', {
            person: escapeHtml(command.personName ?? ''),
          }),
          parseMode: 'HTML',
        });
        return;
      }
    }

    const token = randomBytes(6).toString('hex');
    await this.conversations.save(user.id, {
      token,
      command,
      createdAt: new Date().toISOString(),
    });

    await this.telegram.sendMessage({
      chatId,
      text: this.confirmText(user, command),
      parseMode: 'HTML',
      replyMarkup: confirmKeyboard(user.language, token),
    });
  }

  private missingFieldReply(user: AuthenticatedUser, command: StructuredCommand): string | null {
    if (command.missingFields.includes('amount')) {
      return t(user.language, 'askAmount');
    }
    if (command.missingFields.includes('personName')) {
      return t(user.language, 'askPerson');
    }
    if (command.missingFields.includes('categorySlug')) {
      return t(user.language, 'askCategory', {
        amount: command.amount ?? '',
        currency: user.currency,
      });
    }
    if (command.missingFields.includes('description')) {
      return t(user.language, 'askGoalName');
    }
    if (command.missingFields.includes('date')) {
      return t(user.language, 'askDate');
    }
    return null;
  }

  private async sendGreeting(chatId: number, user: AuthenticatedUser): Promise<void> {
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'greetReply', {
        name: escapeHtml(user.firstName ?? 'there'),
      }),
      parseMode: 'HTML',
      replyMarkup: startKeyboard(user.language),
    });
  }

  private async sendWelcome(chatId: number, user: AuthenticatedUser): Promise<void> {
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'welcome', {
        name: escapeHtml(user.firstName ?? 'there'),
      }),
      parseMode: 'HTML',
      replyMarkup: startKeyboard(user.language),
    });
  }

  private async sendHelp(chatId: number, user: AuthenticatedUser): Promise<void> {
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'help', { limit: this.freeAiDailyLimit }),
      parseMode: 'HTML',
      replyMarkup: helpKeyboard(user.language),
    });
  }

  private async sendDashboard(chatId: number, user: AuthenticatedUser): Promise<void> {
    const dashboard = await this.reports.dashboard(user.id, user.timezone);
    await this.telegram.sendMessage({
      chatId,
      text: formatDashboardMessage(user, dashboard),
      parseMode: 'HTML',
      replyMarkup: helpKeyboard(user.language),
    });
  }

  private async handleFeedback(
    chatId: number,
    user: AuthenticatedUser,
    body: string,
  ): Promise<void> {
    if (!body) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'feedbackPrompt'),
        parseMode: 'HTML',
      });
      return;
    }

    await this.feedback.create(user.id, { message: body, category: 'OTHER' }, 'BOT');
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'feedbackReceived'),
      parseMode: 'HTML',
    });
  }

  private async handleEqubJoin(
    chatId: number,
    user: AuthenticatedUser,
    token: string,
  ): Promise<void> {
    const equb = await this.equbs.findByJoinToken(token);
    if (!equb) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'equbJoinNotFound'),
        parseMode: 'HTML',
      });
      return;
    }

    const telegramId = String(chatId);
    const alreadyLinked = equb.members.find((m) => m.telegramUserId === telegramId);
    if (alreadyLinked) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'equbJoinAlready', {
          equb: escapeHtml(equb.name),
          name: escapeHtml(alreadyLinked.name),
        }),
        parseMode: 'HTML',
      });
      return;
    }

    const unlinked = equb.members.filter((m) => !m.telegramUserId);
    if (unlinked.length === 0) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'equbJoinFull', { equb: escapeHtml(equb.name) }),
        parseMode: 'HTML',
      });
      return;
    }

    // Ask which named slot is theirs; tapping links this Telegram account.
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'equbJoinPick', { equb: escapeHtml(equb.name) }),
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: unlinked.map((member) => [
          { text: member.name, callback_data: `equbjoin:${member.id}` },
        ]),
      },
    });
  }

  private async completeEqubJoin(
    chatId: number,
    from: { id: number; username?: string },
    callbackId: string,
    memberId: string,
  ): Promise<void> {
    const user = await this.users.ensureFromTelegram({ telegramId: String(from.id), username: from.username });
    await this.equbs.linkMember(memberId, String(from.id), from.username ?? null);
    await this.telegram.answerCallbackQuery(callbackId, t(user.language, 'equbJoinedToast'));
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'equbJoinedConfirm'),
      parseMode: 'HTML',
    });
  }

  private async handleCallback(update: TelegramUpdate): Promise<void> {
    const callback = update.callback_query;
    if (!callback?.data || !callback.from || !callback.message) {
      return;
    }

    const user = await this.users.ensureFromTelegram({
      telegramId: String(callback.from.id),
      username: callback.from.username,
      firstName: callback.from.first_name,
      lastName: callback.from.last_name,
      languageCode: callback.from.language_code,
    });

    if (callback.data.startsWith('cmd:')) {
      const command = callback.data.slice(4);
      await this.telegram.answerCallbackQuery(callback.id);
      if (command === 'dashboard') {
        await this.sendDashboard(callback.message.chat.id, user);
      } else if (command === 'help') {
        await this.sendHelp(callback.message.chat.id, user);
      }
      return;
    }

    // Equb join: the member tapped which slot is theirs.
    if (callback.data.startsWith('equbjoin:')) {
      const memberId = callback.data.slice('equbjoin:'.length);
      await this.completeEqubJoin(callback.message.chat.id, callback.from, callback.id, memberId);
      return;
    }

    const [action, token] = callback.data.split(':');
    if (!token || (action !== 'ok' && action !== 'no')) {
      return;
    }

    const pending = await this.conversations.get(user.id);
    if (!pending || pending.token !== token) {
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackExpired'));
      return;
    }

    if (action === 'no') {
      await this.conversations.clear(user.id);
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackCancelled'));
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: t(user.language, 'cancelled'),
        parseMode: 'HTML',
      });
      return;
    }

    try {
      const confirmation = await this.commit(user, pending.command);
      await this.conversations.clear(user.id);
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackSaved'));
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: confirmation,
        parseMode: 'HTML',
      });
    } catch (error) {
      logger.error({ err: error, userId: user.id }, 'Failed to commit Telegram command');
      const message =
        error instanceof AppError && error.code === ERROR_CODE.SUBSCRIPTION_REQUIRED
          ? t(user.language, 'planLimitReached')
          : t(user.language, 'internalError');
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackError'));
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: message,
        parseMode: 'HTML',
      });
    }
  }

  private async commit(user: AuthenticatedUser, command: StructuredCommand): Promise<string> {
    const idempotencyKey = `telegram:${command.intent}:${command.amount}:${command.categorySlug}:${command.personName}:${command.date}:${command.reminderTitle}:${command.description}`;

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
          amount: escapeHtml(saved.amount),
          currency: escapeHtml(saved.currency),
          category: escapeHtml(command.categorySlug ?? ''),
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
        person: escapeHtml(saved.personName),
        amount: escapeHtml(saved.originalAmount),
        currency: escapeHtml(saved.currency),
      });
    }

    if (command.intent === 'RECORD_DEBT_PAYMENT') {
      const debt = await this.findOpenDebt(user.id, command.personName ?? '');
      if (!debt) {
        return t(user.language, 'debtNotFound', {
          person: escapeHtml(command.personName ?? ''),
        });
      }

      const result = await this.debts.recordPayment(user.id, debt.id, {
        amount: command.amount ?? '0',
      });
      return t(user.language, 'recordedDebtPayment', {
        person: escapeHtml(result.debt.personName),
        amount: escapeHtml(result.payment.amount),
        currency: escapeHtml(result.payment.currency),
      });
    }

    if (command.intent === 'CREATE_BUDGET') {
      const category = await this.categories.resolve(
        user.id,
        { categorySlug: command.categorySlug },
        'EXPENSE',
      );
      const saved = await this.budgets.create(user.id, user.timezone, {
        categoryId: category.id,
        amount: command.amount ?? '0',
        currency: user.currency,
      });
      return t(user.language, 'recordedBudget', {
        category: escapeHtml(saved.categoryName),
        amount: escapeHtml(saved.amount),
        currency: escapeHtml(saved.currency),
      });
    }

    if (command.intent === 'CREATE_SAVINGS_GOAL') {
      const saved = await this.savings.create(user.id, {
        name: command.description ?? 'Goal',
        targetAmount: command.amount ?? '0',
        currency: user.currency,
      });
      return t(user.language, 'recordedSavingsGoal', {
        goal: escapeHtml(saved.name),
        amount: escapeHtml(saved.targetAmount),
        currency: escapeHtml(saved.currency),
      });
    }

    if (command.intent === 'CREATE_REMINDER') {
      await this.reminders.create(user.id, user.timezone, {
        title: command.reminderTitle ?? 'Reminder',
        runAt: command.date ?? 'today',
      });
      return t(user.language, 'recordedReminder');
    }

    return buildHelpfulNudge(user.language);
  }

  private async handleQuery(chatId: number, user: AuthenticatedUser, command: StructuredCommand): Promise<void> {
    if (command.intent === 'QUERY_DEBT') {
      const debts = await this.debts.list(user.id);
      const open = debts.filter((debt) => debt.status !== 'SETTLED');
      const lines = open.map((debt) => `${debt.personName}: ${debt.remainingAmount} ${debt.currency}`);
      await this.telegram.sendMessage({
        chatId,
        text: formatDebtsMessage(user, lines),
        parseMode: 'HTML',
        replyMarkup: helpKeyboard(user.language),
      });
      return;
    }

    const dashboard = await this.reports.dashboard(user.id, user.timezone);

    if (command.intent === 'QUERY_SPENDING') {
      await this.telegram.sendMessage({
        chatId,
        text: formatSpendingMessage(user, dashboard, command.categorySlug),
        parseMode: 'HTML',
        replyMarkup: helpKeyboard(user.language),
      });
      return;
    }

    const text =
      command.intent === 'QUERY_BALANCE'
        ? formatBalanceMessage(user, dashboard)
        : formatDashboardMessage(user, dashboard);

    await this.telegram.sendMessage({
      chatId,
      text,
      parseMode: 'HTML',
      replyMarkup: helpKeyboard(user.language),
    });
  }

  private async findOpenDebt(userId: string, personName: string) {
    const needle = personName.trim().toLowerCase();
    if (!needle) return null;

    const debts = await this.debts.list(userId);
    return (
      debts.find(
        (debt) =>
          debt.status !== 'SETTLED' && debt.personName.trim().toLowerCase() === needle,
      ) ?? null
    );
  }

  private confirmText(user: AuthenticatedUser, command: StructuredCommand): string {
    const amount = command.amount ? formatMoney(command.amount) : '';
    if (command.intent === 'CREATE_EXPENSE') {
      return htmlConfirmText(user, 'confirmExpense', {
        amount,
        currency: user.currency,
        category: command.categorySlug ?? command.description ?? '',
      });
    }
    if (command.intent === 'CREATE_INCOME') {
      return htmlConfirmText(user, 'confirmIncome', {
        amount,
        currency: user.currency,
        category: command.categorySlug ?? '',
      });
    }
    if (command.intent === 'CREATE_DEBT') {
      return htmlConfirmText(user, 'confirmDebt', {
        person: command.personName ?? '',
        amount,
        currency: user.currency,
      });
    }
    if (command.intent === 'RECORD_DEBT_PAYMENT') {
      return htmlConfirmText(user, 'confirmDebtPayment', {
        person: command.personName ?? '',
        amount,
        currency: user.currency,
      });
    }
    if (command.intent === 'CREATE_BUDGET') {
      return htmlConfirmText(user, 'confirmBudget', {
        category: command.categorySlug ?? '',
        amount,
        currency: user.currency,
      });
    }
    if (command.intent === 'CREATE_SAVINGS_GOAL') {
      return htmlConfirmText(user, 'confirmSavingsGoal', {
        goal: command.description ?? '',
        amount,
        currency: user.currency,
      });
    }
    return htmlConfirmText(user, 'confirmReminder', {
      title: command.reminderTitle ?? '',
      date: command.date ?? '',
    });
  }
}
