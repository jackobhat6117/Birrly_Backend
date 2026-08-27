import { Router } from 'express';
import type { DebtController } from '@/modules/debts/debt.controller';

export function debtRoutes(controller: DebtController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.post('/:id/payments', controller.pay);
  router.get('/:id/payments', controller.history);
  return router;
}
