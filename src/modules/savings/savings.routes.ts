import { Router } from 'express';
import type { SavingsController } from '@/modules/savings/savings.controller';

export function savingsRoutes(controller: SavingsController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.post('/:id/contributions', controller.contribute);
  router.delete('/:id', controller.remove);
  return router;
}
