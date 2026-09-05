import { Router } from 'express';
import type { AppContainer } from '@/app/container';
import { createAuthMiddleware } from '@/middleware/auth';
import { rateLimit } from '@/middleware/rate-limit';
import { accountRoutes } from '@/modules/accounts/account.routes';
import { categoryRoutes } from '@/modules/categories/category.routes';
import { debtRoutes } from '@/modules/debts/debt.routes';
import { reminderRoutes } from '@/modules/reminders/reminder.routes';
import { reportRoutes } from '@/modules/reports/report.routes';
import { budgetRoutes } from '@/modules/budgets/budget.routes';
import { savingsRoutes } from '@/modules/savings/savings.routes';
import { subscriptionRoutes } from '@/modules/subscriptions/subscription.routes';
import { transactionRoutes } from '@/modules/transactions/transaction.routes';
import { userRoutes } from '@/modules/users/user.routes';
import { analyticsRoutes } from '@/modules/analytics/analytics.routes';
import { feedbackRoutes } from '@/modules/feedback/feedback.routes';

export function createRoutes(container: AppContainer): Router {
  const router = Router();
  const auth = createAuthMiddleware(container.userService);
  const apiLimit = rateLimit({ prefix: 'api' });

  router.use(apiLimit);
  router.use(auth);

  router.use('/users', userRoutes(container.userController));
  router.use('/subscriptions', subscriptionRoutes(container.subscriptionController));
  router.use('/accounts', accountRoutes(container.accountController));
  router.use('/categories', categoryRoutes(container.categoryController));
  router.use('/transactions', transactionRoutes(container.transactionController));
  router.use('/debts', debtRoutes(container.debtController));
  router.use('/reminders', reminderRoutes(container.reminderController));
  router.use('/reports', reportRoutes(container.reportController));
  router.use('/budgets', budgetRoutes(container.budgetController));
  router.use('/savings-goals', savingsRoutes(container.savingsController));
  router.use('/analytics', rateLimit({ prefix: 'analytics', max: 60 }), analyticsRoutes(container.analyticsController));
  router.use('/feedback', rateLimit({ prefix: 'feedback', max: 5 }), feedbackRoutes(container.feedbackController));
  router.get('/dashboard', container.reportController.dashboard);

  return router;
}
