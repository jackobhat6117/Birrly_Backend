import { Router } from 'express';
import type { EqubController } from '@/modules/equb/equb.controller';
import { rateLimit } from '@/middleware/rate-limit';

export function equbRoutes(controller: EqubController): Router {
  const router = Router();
  router.get('/', controller.list);
  router.post('/', controller.create);
  router.get('/:id', controller.get);
  router.post('/:id/contributions', controller.recordContribution);
  router.post('/:id/advance', controller.advanceCycle);
  // Each nudge fans out to real Telegram DMs — cap how often one can fire.
  router.post('/:id/nudge', rateLimit({ prefix: 'equb-nudge', max: 6, windowMs: 60 * 60 * 1000 }), controller.nudge);
  return router;
}
