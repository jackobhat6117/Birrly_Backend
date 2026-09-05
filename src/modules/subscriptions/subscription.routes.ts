import { Router } from 'express';
import type { SubscriptionController } from '@/modules/subscriptions/subscription.controller';
import { validate } from '@/middleware/validate';
import { createUpgradeRequestSchema, redeemPromoSchema } from '@/modules/subscriptions/subscription.schema';

export function subscriptionRoutes(controller: SubscriptionController): Router {
  const router = Router();
  router.get('/me', controller.me);
  router.post('/upgrade-request', validate(createUpgradeRequestSchema), controller.upgradeRequest);
  router.post('/redeem-promo', validate(redeemPromoSchema), controller.redeemPromo);
  router.post('/trial', controller.trial);
  return router;
}
