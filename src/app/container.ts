import { prisma } from '@/database/prisma';
import { redis } from '@/database/redis';
import { createLlmProvider } from '@/integrations/llm/llm.provider';
import { config } from '@/app/config';
import { ConversationStore } from '@/integrations/telegram/conversation.store';
import { telegramBotAdapter } from '@/integrations/telegram/telegram-bot.adapter';
import { TelegramIdempotencyStore } from '@/integrations/telegram/telegram-idempotency.store';
import { TelegramUpdateHandler } from '@/integrations/telegram/telegram-update.handler';
import { TelegramWebhookController } from '@/integrations/telegram/telegram-webhook.controller';
import { BullmqReminderScheduler } from '@/jobs/reminder.scheduler';
import { AccountController } from '@/modules/accounts/account.controller';
import { AccountRepository } from '@/modules/accounts/account.repository';
import { AccountService } from '@/modules/accounts/account.service';
import { AiInterpreter } from '@/modules/ai/ai.interpreter';
import { AuditService } from '@/modules/audit/audit.service';
import { CategoryController } from '@/modules/categories/category.controller';
import { CategoryRepository } from '@/modules/categories/category.repository';
import { CategoryService } from '@/modules/categories/category.service';
import { DebtController } from '@/modules/debts/debt.controller';
import { DebtRepository } from '@/modules/debts/debt.repository';
import { DebtService } from '@/modules/debts/debt.service';
import { NotificationRepository } from '@/modules/notifications/notification.repository';
import { NotificationService } from '@/modules/notifications/notification.service';
import { ReminderController } from '@/modules/reminders/reminder.controller';
import { ReminderRepository } from '@/modules/reminders/reminder.repository';
import { ReminderService } from '@/modules/reminders/reminder.service';
import { ReportController } from '@/modules/reports/report.controller';
import { ReportService } from '@/modules/reports/report.service';
import { BudgetController } from '@/modules/budgets/budget.controller';
import { BudgetRepository } from '@/modules/budgets/budget.repository';
import { BudgetService } from '@/modules/budgets/budget.service';
import { SavingsController } from '@/modules/savings/savings.controller';
import { SavingsRepository } from '@/modules/savings/savings.repository';
import { SavingsService } from '@/modules/savings/savings.service';
import { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { TransactionController } from '@/modules/transactions/transaction.controller';
import { TransactionRepository } from '@/modules/transactions/transaction.repository';
import { TransactionService } from '@/modules/transactions/transaction.service';
import { UserController } from '@/modules/users/user.controller';
import { UserRepository } from '@/modules/users/user.repository';
import { UserService } from '@/modules/users/user.service';
import { AnalyticsController } from '@/modules/analytics/analytics.controller';
import { AnalyticsService } from '@/modules/analytics/analytics.service';
import { AdminController } from '@/modules/admin/admin.controller';
import { AdminService } from '@/modules/admin/admin.service';

export function createContainer() {
  const userRepository = new UserRepository(prisma);
  const accountRepository = new AccountRepository(prisma);
  const categoryRepository = new CategoryRepository(prisma);
  const transactionRepository = new TransactionRepository(prisma);
  const debtRepository = new DebtRepository(prisma);
  const reminderRepository = new ReminderRepository(prisma);
  const notificationRepository = new NotificationRepository(prisma);
  const budgetRepository = new BudgetRepository(prisma);
  const savingsRepository = new SavingsRepository(prisma);

  const auditService = new AuditService(prisma);
  const subscriptionService = new SubscriptionService(prisma);
  const userService = new UserService(prisma, userRepository, auditService);
  const accountService = new AccountService(accountRepository);
  const categoryService = new CategoryService(categoryRepository, auditService);
  const transactionService = new TransactionService(
    transactionRepository,
    accountService,
    categoryService,
    auditService,
  );
  const debtService = new DebtService(prisma, debtRepository, subscriptionService, auditService);
  const reminderScheduler = new BullmqReminderScheduler();
  const reminderService = new ReminderService(
    reminderRepository,
    subscriptionService,
    auditService,
    reminderScheduler,
  );
  const notificationService = new NotificationService(
    notificationRepository,
    userRepository,
    telegramBotAdapter,
  );
  const reportService = new ReportService(prisma, subscriptionService);
  const budgetService = new BudgetService(
    budgetRepository,
    categoryService,
    subscriptionService,
    auditService,
  );
  const savingsService = new SavingsService(savingsRepository, subscriptionService, auditService);
  const analyticsService = new AnalyticsService(prisma);
  const adminService = new AdminService(prisma);
  const interpreter = new AiInterpreter(createLlmProvider(config.llm));
  const conversations = new ConversationStore(redis);
  const telegramHandler = new TelegramUpdateHandler(
    userService,
    interpreter,
    transactionService,
    debtService,
    reminderService,
    reportService,
    conversations,
    telegramBotAdapter,
    subscriptionService,
  );
  const telegramIdempotency = new TelegramIdempotencyStore(prisma);

  return {
    prisma,
    userRepository,
    reminderRepository,
    reminderScheduler,
    userService,
    accountService,
    categoryService,
    transactionService,
    debtService,
    reminderService,
    notificationService,
    reportService,
    budgetService,
    savingsService,
    subscriptionService,
    analyticsService,
    adminService,
    userController: new UserController(userService, subscriptionService),
    accountController: new AccountController(accountService),
    categoryController: new CategoryController(categoryService),
    transactionController: new TransactionController(transactionService),
    debtController: new DebtController(debtService),
    reminderController: new ReminderController(reminderService),
    reportController: new ReportController(reportService),
    budgetController: new BudgetController(budgetService),
    savingsController: new SavingsController(savingsService),
    analyticsController: new AnalyticsController(analyticsService),
    adminController: new AdminController(adminService),
    telegramWebhookController: new TelegramWebhookController(telegramHandler, telegramIdempotency),
  };
}

export type AppContainer = ReturnType<typeof createContainer>;
