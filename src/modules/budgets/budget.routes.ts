import { Router } from 'express';
import type { BudgetController } from '@/modules/budgets/budget.controller';

export function budgetRoutes(controller: BudgetController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.patch('/:id', controller.update);
  router.delete('/:id', controller.remove);
  return router;
}
