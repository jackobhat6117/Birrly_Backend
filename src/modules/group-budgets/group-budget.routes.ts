import { Router } from 'express';
import type { GroupBudgetController } from '@/modules/group-budgets/group-budget.controller';

export function groupBudgetRoutes(controller: GroupBudgetController): Router {
  const router = Router();

  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/join', controller.join);
  router.get('/:id', controller.get);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.delete);
  router.post('/:id/expenses', controller.addExpense);
  router.post('/:id/members', controller.addMemberByTelegramId);
  router.delete('/:id/members/:userId', controller.removeMember);
  router.post('/:id/link-chat', controller.linkTelegramChat);

  return router;
}
