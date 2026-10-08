import { randomBytes } from 'node:crypto';
import type { AiParseService } from '@/modules/ai/ai-parse.service';
import type { AiInteractionService } from '@/modules/ai/ai-interaction.service';
import type { BudgetService } from '@/modules/budgets/budget.service';
import type { GroupBudgetService } from '@/modules/group-budgets/group-budget.service';
import type { GroupSavingsService } from '@/modules/group-savings/group-savings.service';
import type { CategoryService } from '@/modules/categories/category.service';
import type { DebtService } from '@/modules/debts/debt.service';
import type { EqubService } from '@/modules/equb/equb.service';
import type { ReminderService } from '@/modules/reminders/reminder.service';
import type { ReportService } from '@/modules/reports/report.service';
import type { CoachService } from '@/modules/coach/coach.service';
import type { CoachLens } from '@/modules/coach/coach.types';
import { COACH_LENSES } from '@/modules/coach/coach.types';
import type { SavingsService } from '@/modules/savings/savings.service';
import type { TransactionService } from '@/modules/transactions/transaction.service';
import type { AuthenticatedUser } from '@/modules/users/user.types';
import type { UserService } from '@/modules/users/user.service';
import type { FeedbackService } from '@/modules/feedback/feedback.service';
import type { StructuredCommand } from '@/modules/ai/ai.types';
import type { ConversationStore } from '@/integrations/telegram/conversation.store';
import type { SpeechTranscriber } from '@/integrations/speech/speech.transcriber';
import type { TelegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import type { TelegramUpdate, TelegramVoice } from '@/integrations/telegram/telegram.types';
import {
  confirmKeyboard,
  escapeHtml,
  formatBalanceMessage,
  formatCoachMessage,
  formatDashboardMessage,
  formatDebtsMessage,
  formatSpendingMessage,
  helpKeyboard,
  htmlConfirmText,
  parseSlashCommand,
  upgradeKeyboard,
  startKeyboard,
} from '@/integrations/telegram/telegram-ui';
import { buildHelpfulNudge } from '@/integrations/telegram/nudge-message';
import { openMiniAppKeyboard } from '@/integrations/telegram/telegram-bootstrap';
import { categoryLabel } from '@/shared/constants/categories';
import { AppError, ERROR_CODE } from '@/shared/errors/app-error';
import { t } from '@/shared/i18n';
import { logger } from '@/shared/logger/logger';
import { formatMoney } from '@/shared/utils/money';
import { nowInZone } from '@/shared/utils/dates';

export class TelegramUpdateHandler {
  constructor(
    private readonly users: UserService,
    private readonly aiParse: AiParseService,
    private readonly transactions: TransactionService,
    private readonly debts: DebtService,
    private readonly equbs: EqubService,
    private readonly reminders: ReminderService,
    private readonly reports: ReportService,
    private readonly coach: CoachService,
    private readonly budgets: BudgetService,
    private readonly savings: SavingsService,
    private readonly categories: CategoryService,
    private readonly groupBudgets: GroupBudgetService,
    private readonly groupSavings: GroupSavingsService,
    private readonly conversations: ConversationStore,
    private readonly telegram: TelegramBotAdapter,
    private readonly feedback: FeedbackService,
    private readonly aiInteractions: AiInteractionService,
    private readonly freeAiDailyLimit: number,
    private readonly speech: SpeechTranscriber,
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
      const voice = message?.voice ?? message?.audio;
      if (!message?.from || (!message.text && !voice)) {
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

      if (voice) {
        await this.handleVoice(message.chat.id, user, voice);
        return;
      }

      const slash = parseSlashCommand(message.text ?? '');
      if (slash) {
        await this.handleSlashCommand(message.chat.id, user, slash.command, slash.args);
        return;
      }

      const text = (message.text ?? '').trim();
      const pending = await this.conversations.get(user.id);
      if (pending?.awaiting === 'monthlyIncome') {
        const captured = await this.captureOnboardingIncome(message.chat.id, user, text);
        if (captured) return;
      }

      await this.handleNaturalLanguage(message.chat.id, user, text);
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
        // Deep link: /start gb-<token> joins a group budget.
        if (args.startsWith('gb-')) {
          await this.handleGroupBudgetJoin(chatId, user, args.slice('gb-'.length));
          return;
        }
        // Deep link: /start gs-<token> joins a group savings goal.
        if (args.startsWith('gs-')) {
          await this.handleGroupSavingsJoin(chatId, user, args.slice('gs-'.length));
          return;
        }
        await this.sendWelcome(chatId, user);
        return;
      case 'groupbudget':
      case 'gb':
        await this.handleGroupBudgetCommand(chatId, user, args);
        return;
      case 'groupsaving':
      case 'groupsavings':
      case 'gs':
        await this.handleGroupSavingsCommand(chatId, user, args);
        return;
      case 'help':
        await this.sendHelp(chatId, user);
        return;
      case 'dashboard':
        await this.sendDashboard(chatId, user);
        return;
      case 'coach':
        await this.sendCoach(chatId, user, args);
        return;
      case 'feedback':
        await this.handleFeedback(chatId, user, args);
        return;
      default:
        await this.sendNudge(chatId, user);
    }
  }

  private async sendNudge(chatId: number, user: AuthenticatedUser, text = ''): Promise<void> {
    const heard = text.trim()
      ? `${user.language === 'am' ? 'ሰማሁት' : 'I heard'}: <code>${escapeHtml(text.trim())}</code>\n\n`
      : '';
    await this.telegram.sendMessage({
      chatId,
      text: heard + buildHelpfulNudge(user.language, text),
      parseMode: 'HTML',
      replyMarkup: startKeyboard(user.language),
    });
  }

  private async handleVoice(chatId: number, user: AuthenticatedUser, voice: TelegramVoice): Promise<void> {
    const maxSeconds = 60;
    const maxBytes = 8 * 1024 * 1024;
    if (voice.duration > maxSeconds || (voice.file_size ?? 0) > maxBytes) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'voiceTooLong'),
        parseMode: 'HTML',
      });
      return;
    }
    if (!this.speech.isEnabled()) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'voiceUnavailable'),
        parseMode: 'HTML',
      });
      return;
    }

    const audio = await this.telegram.downloadFile(voice.file_id);
    let transcript: string;
    try {
      transcript = await this.speech.transcribe(audio, voice.mime_type ?? 'audio/ogg');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      logger.warn({ err: error, userId: user.id }, 'Voice transcription failed');
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'voiceFailed', { reason: escapeHtml(reason) }),
        parseMode: 'HTML',
      });
      return;
    }
    if (!transcript) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'voiceEmpty'),
        parseMode: 'HTML',
      });
      return;
    }

    logger.info({ userId: user.id, chars: transcript.length }, 'Transcribed Telegram voice note');
    await this.handleNaturalLanguage(chatId, user, transcript);
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
        text: t(user.language, 'aiQuotaExceeded', { limit: parsed.usage.limit }),
        parseMode: 'HTML',
        replyMarkup: upgradeKeyboard(user.language),
      });
      return;
    }

    const command = parsed.command;

    if (command.intent === 'UNKNOWN') {
      // A dead-end is the most valuable learning signal — record the miss as a
      // labeled negative (no-op unless capture is enabled). This is what makes
      // "the parser failed on this phrasing" trainable instead of invisible.
      await this.aiInteractions.recordParse({
        userId: user.id,
        inputText: text,
        language: user.language,
        command,
        usedLlm: parsed.usedLlm,
      });
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

    // If message is in a linked group chat and user logs an expense, record it for the group budget!
    const linkedGroupBudget = await this.groupBudgets.findByTelegramChatId(String(chatId));
    if (linkedGroupBudget && command.intent === 'CREATE_EXPENSE') {
      try {
        const cat = command.categorySlug ? await this.categories.resolve(user.id, { categorySlug: command.categorySlug }, 'EXPENSE') : null;
        await this.groupBudgets.addExpense(
          linkedGroupBudget.id,
          user.id,
          {
            amount: command.amount ?? '0',
            categoryId: cat?.id,
            description: command.description,
          },
          'TELEGRAM',
        );
        const updated = await this.groupBudgets.getById(linkedGroupBudget.id, user.id);
        const name = user.firstName || user.telegramUsername || 'Member';
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'groupBudgetExpenseLogged', {
            amount: command.amount ?? '0',
            currency: user.currency,
            user: escapeHtml(name),
            name: escapeHtml(updated.name),
            remaining: updated.remaining,
          }),
          parseMode: 'HTML',
        });
        return;
      } catch (err: unknown) {
        logger.warn({ err }, 'Failed to record expense for linked group budget');
      }
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

    const ready = await this.offerMissingCategory(user.id, command);
    const token = randomBytes(6).toString('hex');
    // Best-effort label capture (no-op unless AI_TRAINING_CAPTURE is on): remember
    // what we predicted so we can score it against what the user confirms below.
    const aiInteractionId = await this.aiInteractions.recordParse({
      userId: user.id,
      inputText: text,
      language: user.language,
      command: ready,
      usedLlm: parsed.usedLlm,
    });
    await this.conversations.save(user.id, {
      token,
      command: ready,
      createdAt: new Date().toISOString(),
      aiInteractionId: aiInteractionId ?? undefined,
    });

    await this.telegram.sendMessage({
      chatId,
      text: this.confirmText(user, ready),
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

    if (!user.monthlyIncome) {
      await this.askMonthlyIncome(chatId, user);
    }
  }

  private async askMonthlyIncome(chatId: number, user: AuthenticatedUser): Promise<void> {
    await this.conversations.save(user.id, {
      token: randomBytes(6).toString('hex'),
      command: {
        intent: 'UNKNOWN',
        confidence: 0,
        missingFields: [],
        source: 'fallback',
      },
      createdAt: new Date().toISOString(),
      awaiting: 'monthlyIncome',
    });
    await this.telegram.sendMessage({
      chatId,
      text: t(user.language, 'askMonthlyIncome'),
      parseMode: 'HTML',
      replyMarkup: {
        inline_keyboard: [[{ text: t(user.language, 'skipIncomeButton'), callback_data: 'income:skip' }]],
      },
    });
  }

  /**
   * Returns true when the message was an income answer (or a prompt to retry).
   * A normal expense like "80 taxi" returns false so logging still works.
   */
  private async captureOnboardingIncome(
    chatId: number,
    user: AuthenticatedUser,
    text: string,
  ): Promise<boolean> {
    const amount = parseOnboardingIncomeAmount(text);
    if (!amount) {
      if (/^\d/.test(text)) {
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'incomeNeedAmount'),
          parseMode: 'HTML',
        });
        return true;
      }
      return false;
    }

    const command: StructuredCommand = {
      intent: 'CREATE_INCOME',
      amount,
      currency: user.currency,
      categorySlug: 'salary',
      description: 'Salary',
      confidence: 1,
      missingFields: [],
      source: 'fallback',
      setMonthlyIncome: true,
    };
    const ready = await this.offerMissingCategory(user.id, command);
    const token = randomBytes(6).toString('hex');
    await this.conversations.save(user.id, {
      token,
      command: ready,
      createdAt: new Date().toISOString(),
    });
    await this.telegram.sendMessage({
      chatId,
      text: this.confirmText(user, ready),
      parseMode: 'HTML',
      replyMarkup: confirmKeyboard(user.language, token),
    });
    return true;
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

  /**
   * `/coach [cashflow|leaks|audit]` — the AI Money Coach inside Telegram. Same
   * CoachService the Mini App uses; Premium-gated by the service itself. Sends a
   * quiet Premium prompt to free users and a "warming up" note when the LLM is
   * off or there isn't enough data yet.
   */
  private async sendCoach(chatId: number, user: AuthenticatedUser, args: string): Promise<void> {
    const requested = args.trim().toLowerCase();
    const lens: CoachLens = (COACH_LENSES as readonly string[]).includes(requested)
      ? (requested as CoachLens)
      : 'cashflow';
    const now = nowInZone(user.timezone);

    let analysis;
    try {
      analysis = await this.coach.getOrGenerate(
        lens,
        {
          userId: user.id,
          timezone: user.timezone,
          language: user.language,
          currency: user.currency,
          monthlyIncome: user.monthlyIncome,
          paydayDay: user.paydayDay,
        },
        now.year,
        now.month,
      );
    } catch (error) {
      if (error instanceof AppError && error.code === ERROR_CODE.SUBSCRIPTION_REQUIRED) {
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'coachPremiumOnly'),
          parseMode: 'HTML',
          replyMarkup: helpKeyboard(user.language),
        });
        return;
      }
      throw error;
    }

    if (!analysis) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'coachUnavailable'),
        parseMode: 'HTML',
        replyMarkup: helpKeyboard(user.language),
      });
      return;
    }

    await this.telegram.sendMessage({
      chatId,
      text: formatCoachMessage(user, analysis),
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

  private async handleGroupBudgetJoin(
    chatId: number,
    user: AuthenticatedUser,
    token: string,
  ): Promise<void> {
    const gb = await this.groupBudgets.findByJoinToken(token);
    if (!gb) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupBudgetJoinNotFound'),
        parseMode: 'HTML',
      });
      return;
    }

    try {
      await this.groupBudgets.joinByToken(token, user.id);
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupBudgetJoined', { name: escapeHtml(gb.name) }),
        parseMode: 'HTML',
        replyMarkup: openMiniAppKeyboard(user.language),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t(user.language, 'internalError');
      await this.telegram.sendMessage({
        chatId,
        text: escapeHtml(msg),
        parseMode: 'HTML',
      });
    }
  }

  private async handleGroupBudgetCommand(
    chatId: number,
    user: AuthenticatedUser,
    args: string,
  ): Promise<void> {
    const trimmed = args.trim();
    // In group chat, if user sends /gb link <token>
    if (trimmed.startsWith('link ')) {
      const token = trimmed.slice(5).trim();
      const gb = await this.groupBudgets.findByJoinToken(token);
      if (!gb) {
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'groupBudgetJoinNotFound'),
          parseMode: 'HTML',
        });
        return;
      }
      await this.groupBudgets.linkTelegramChat(gb.id, user.id, String(chatId));
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupBudgetLinked', { name: escapeHtml(gb.name) }),
        parseMode: 'HTML',
      });
      return;
    }

    // Check if current chat is linked to a group budget
    const linked = await this.groupBudgets.findByTelegramChatId(String(chatId));
    if (linked) {
      const details = await this.groupBudgets.getById(linked.id, user.id);
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupBudgetStatus', {
          name: escapeHtml(details.name),
          amount: details.amount,
          spent: details.spent,
          currency: details.currency,
          percent: details.percent,
          remaining: details.remaining,
        }),
        parseMode: 'HTML',
      });
      return;
    }

    // Otherwise list user's group budgets
    const list = await this.groupBudgets.list(user.id);
    if (list.length === 0) {
      await this.telegram.sendMessage({
        chatId,
        text: 'You have no group budgets. Open the Mini App to create one or join with an invite link.',
        parseMode: 'HTML',
      });
      return;
    }

    const lines = list.map((b) => `• <b>${escapeHtml(b.name)}</b>: ${b.spent} / ${b.amount} ${b.currency} (${b.percent}%)`).join('\n');
    await this.telegram.sendMessage({
      chatId,
      text: `<b>Your Group Budgets:</b>\n\n${lines}`,
      parseMode: 'HTML',
    });
  }

  private async handleGroupSavingsJoin(
    chatId: number,
    user: AuthenticatedUser,
    token: string,
  ): Promise<void> {
    const gs = await this.groupSavings.findByJoinToken(token);
    if (!gs) {
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupSavingsJoinNotFound'),
        parseMode: 'HTML',
      });
      return;
    }

    try {
      await this.groupSavings.joinByToken(token, user.id);
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupSavingsJoined', { name: escapeHtml(gs.name) }),
        parseMode: 'HTML',
        replyMarkup: openMiniAppKeyboard(user.language),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t(user.language, 'internalError');
      await this.telegram.sendMessage({
        chatId,
        text: escapeHtml(msg),
        parseMode: 'HTML',
      });
    }
  }

  private async handleGroupSavingsCommand(
    chatId: number,
    user: AuthenticatedUser,
    args: string,
  ): Promise<void> {
    const trimmed = args.trim();

    // Link chat: /gs link <token>
    if (trimmed.startsWith('link ')) {
      const token = trimmed.slice(5).trim();
      const gs = await this.groupSavings.findByJoinToken(token);
      if (!gs) {
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'groupSavingsJoinNotFound'),
          parseMode: 'HTML',
        });
        return;
      }
      await this.groupSavings.linkTelegramChat(gs.id, user.id, String(chatId));
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupSavingsLinked', { name: escapeHtml(gs.name) }),
        parseMode: 'HTML',
      });
      return;
    }

    // Save into linked goal: /gs save 5000 [note]
    if (trimmed.startsWith('save ') || trimmed.startsWith('contribute ')) {
      const linked = await this.groupSavings.findByTelegramChatId(String(chatId));
      if (!linked) {
        await this.telegram.sendMessage({
          chatId,
          text: 'This chat is not linked to any group savings goal yet. Link it with <code>/gs link &lt;token&gt;</code> first.',
          parseMode: 'HTML',
        });
        return;
      }

      const parts = trimmed.split(/\s+/).slice(1);
      const amount = parts[0]?.trim();
      if (!amount) {
        await this.telegram.sendMessage({
          chatId,
          text: 'Please specify an amount to save. Example: <code>/gs save 5000 [optional note]</code>',
          parseMode: 'HTML',
        });
        return;
      }
      const note = parts.slice(1).join(' ') || undefined;

      try {
        const updated = await this.groupSavings.addContribution(
          linked.id,
          user.id,
          { amount, note },
          'TELEGRAM',
        );
        const name = user.firstName || user.telegramUsername || 'Member';
        await this.telegram.sendMessage({
          chatId,
          text: t(user.language, 'groupSavingsContributionLogged', {
            amount,
            currency: updated.currency,
            user: escapeHtml(name),
            name: escapeHtml(updated.name),
            saved: updated.currentAmount,
            percent: updated.percent,
          }),
          parseMode: 'HTML',
        });
        return;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : t(user.language, 'internalError');
        await this.telegram.sendMessage({
          chatId,
          text: escapeHtml(msg),
          parseMode: 'HTML',
        });
        return;
      }
    }

    // Check if current chat is linked to a group savings goal
    const linked = await this.groupSavings.findByTelegramChatId(String(chatId));
    if (linked) {
      const details = await this.groupSavings.getById(linked.id, user.id);
      await this.telegram.sendMessage({
        chatId,
        text: t(user.language, 'groupSavingsStatus', {
          name: escapeHtml(details.name),
          target: details.targetAmount,
          saved: details.currentAmount,
          currency: details.currency,
          percent: details.percent,
          remaining: details.remaining,
        }),
        parseMode: 'HTML',
      });
      return;
    }

    // Otherwise list user's group savings
    const list = await this.groupSavings.list(user.id);
    if (list.length === 0) {
      await this.telegram.sendMessage({
        chatId,
        text: 'You have no group savings goals. Open the Mini App to create one or join with an invite link.',
        parseMode: 'HTML',
      });
      return;
    }

    const lines = list.map((s) => `• <b>${escapeHtml(s.name)}</b>: ${s.currentAmount} / ${s.targetAmount} ${s.currency} (${s.percent}%)`).join('\n');
    await this.telegram.sendMessage({
      chatId,
      text: `<b>Your Group Savings Goals:</b>\n\n${lines}`,
      parseMode: 'HTML',
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

    if (callback.data === 'income:skip') {
      const pending = await this.conversations.get(user.id);
      if (pending?.awaiting === 'monthlyIncome') {
        await this.conversations.clear(user.id);
      }
      await this.telegram.answerCallbackQuery(callback.id);
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: t(user.language, 'incomeSkipped'),
        parseMode: 'HTML',
      });
      return;
    }

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
      await this.aiInteractions.recordOutcome(pending.aiInteractionId, 'CANCELED');
      await this.conversations.clear(user.id);
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackCancelled'));
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: t(user.language, 'cancelled'),
        parseMode: 'HTML',
      });
      return;
    }

    let confirmation: string | null = null;
    try {
      confirmation = await this.commit(user, pending.command, token, pending.aiInteractionId);
      // Confirmed as-is → a positive label (predicted === final).
      await this.aiInteractions.recordOutcome(
        pending.aiInteractionId,
        'CONFIRMED',
        pending.command,
        pending.command,
      );
      await this.conversations.clear(user.id);
      try {
        await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackSaved'));
      } catch (notifyError) {
        // The row is already saved. An expired callback button must not look like a failed save.
        logger.warn({ err: notifyError, userId: user.id }, 'Telegram callback answer failed after save');
      }
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: confirmation,
        parseMode: 'HTML',
      });
    } catch (error) {
      if (confirmation) {
        logger.error({ err: error, userId: user.id }, 'Saved Telegram command but failed to report it');
        await this.telegram.sendMessage({
          chatId: callback.message.chat.id,
          text: confirmation,
          parseMode: 'HTML',
        });
        return;
      }

      logger.error({ err: error, userId: user.id }, 'Failed to commit Telegram command');
      const message =
        error instanceof AppError && error.code === ERROR_CODE.SUBSCRIPTION_REQUIRED
          ? t(user.language, 'planLimitReached')
          : error instanceof AppError
            ? escapeHtml(error.message)
            : t(user.language, 'internalError');
      await this.telegram.answerCallbackQuery(callback.id, t(user.language, 'callbackError'));
      await this.telegram.sendMessage({
        chatId: callback.message.chat.id,
        text: message,
        parseMode: 'HTML',
      });
    }
  }

  private async commit(
    user: AuthenticatedUser,
    command: StructuredCommand,
    confirmationToken: string,
    aiInteractionId?: string,
  ): Promise<string> {
    // One key per Confirm tap. A second "80 taxi" is a new expense; tapping the
    // same button twice (Telegram retry) still returns the row already saved.
    const idempotencyKey = `telegram:${confirmationToken}`;

    if (command.intent === 'CREATE_EXPENSE' || command.intent === 'CREATE_INCOME') {
      const type = command.intent === 'CREATE_EXPENSE' ? 'EXPENSE' : 'INCOME';
      const category = await this.resolveCommandCategory(user.id, command, type);
      const saved = await this.transactions.create(user.id, user.currency, user.timezone, {
        type,
        amount: command.amount ?? '0',
        categoryId: category.id,
        description: command.description,
        transactionDate: command.date,
        source: 'TELEGRAM',
        idempotencyKey,
        aiInteractionId,
      });
      if (command.setMonthlyIncome) {
        await this.users.updateProfile(user.id, { monthlyIncome: saved.amount });
      }
      return t(
        user.language,
        command.proposedCategoryName
          ? 'recordedAddedCategory'
          : command.intent === 'CREATE_EXPENSE'
            ? 'recordedExpense'
            : 'recordedIncome',
        {
          amount: escapeHtml(saved.amount),
          currency: escapeHtml(saved.currency),
          category: escapeHtml(command.proposedCategoryName ?? command.categorySlug ?? ''),
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
        direction: this.debtDirectionLabel(user, saved.type),
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
      const category = await this.resolveCommandCategory(user.id, command, 'EXPENSE');
      const saved = await this.budgets.create(user.id, user.timezone, {
        categoryId: category.id,
        amount: command.amount ?? '0',
        currency: user.currency,
      });
      return t(user.language, 'recordedBudget', {
        category: escapeHtml(saved.categoryName ?? saved.name),
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
      const lines = open.map((debt) => {
        const mark = debt.type === 'I_OWE' ? '🔴' : '🟢';
        const direction = this.debtDirectionLabel(user, debt.type);
        return `${mark} ${direction} — ${debt.personName}: ${debt.remainingAmount} ${debt.currency}`;
      });
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

  /** Plain-language direction label: OWED_TO_ME → "You lent", I_OWE → "You borrowed". */
  private debtDirectionLabel(user: AuthenticatedUser, type: 'OWED_TO_ME' | 'I_OWE'): string {
    return t(user.language, type === 'I_OWE' ? 'debtBorrowed' : 'debtLent');
  }

  /**
   * A new user often has no Food/Transport row yet. Ask before saving, instead
   * of failing confirm with "Category is required."
   */
  private async offerMissingCategory(
    userId: string,
    command: StructuredCommand,
  ): Promise<StructuredCommand> {
    const type =
      command.intent === 'CREATE_INCOME'
        ? 'INCOME'
        : command.intent === 'CREATE_EXPENSE' || command.intent === 'CREATE_BUDGET'
          ? 'EXPENSE'
          : null;
    if (!type || !command.categorySlug || command.proposedCategoryName) {
      return command;
    }

    const existing = await this.categories.findBySlug(userId, command.categorySlug, type);
    if (existing) return command;

    return {
      ...command,
      proposedCategoryName: categoryLabel(command.categorySlug, command.description ?? ''),
    };
  }

  private async resolveCommandCategory(
    userId: string,
    command: StructuredCommand,
    type: 'EXPENSE' | 'INCOME',
  ) {
    if (command.proposedCategoryName && command.categorySlug) {
      return this.categories.ensureBySlug(userId, {
        name: command.proposedCategoryName,
        slug: command.categorySlug,
        kind: type,
      });
    }
    return this.categories.resolve(userId, { categorySlug: command.categorySlug }, type);
  }

  private confirmText(user: AuthenticatedUser, command: StructuredCommand): string {
    const amount = command.amount ? formatMoney(command.amount) : '';
    const category = command.proposedCategoryName ?? categoryLabel(command.categorySlug, command.description ?? '');
    if (command.intent === 'CREATE_EXPENSE') {
      return htmlConfirmText(user, command.proposedCategoryName ? 'confirmAddCategoryExpense' : 'confirmExpense', {
        amount,
        currency: user.currency,
        category,
      });
    }
    if (command.intent === 'CREATE_INCOME') {
      return htmlConfirmText(user, command.proposedCategoryName ? 'confirmAddCategoryIncome' : 'confirmIncome', {
        amount,
        currency: user.currency,
        category,
      });
    }
    if (command.intent === 'CREATE_DEBT') {
      return htmlConfirmText(user, 'confirmDebt', {
        direction: this.debtDirectionLabel(user, command.debtType ?? 'OWED_TO_ME'),
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
      return htmlConfirmText(user, command.proposedCategoryName ? 'confirmAddCategoryBudget' : 'confirmBudget', {
        category,
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

/** Amount-only replies to the first-launch income question. Expense phrases stay null. */
export function parseOnboardingIncomeAmount(text: string): string | null {
  const match = text
    .trim()
    .match(
      /^(?:salary|income|wage|ደመወዝ)?\s*(\d{1,3}(?:[, ]\d{3})+|\d{1,12})(?:[.,](\d{1,2}))?\s*(?:birr|br|etb|ብር|salary|income|wage|ደመወዝ)?\s*$/i,
    );
  if (!match?.[1]) return null;
  const whole = match[1].replace(/[, ]/g, '');
  const amount = match[2] ? `${whole}.${match[2]}` : whole;
  if (Number(amount) <= 0) return null;
  return amount;
}
