import { Router } from 'express';
import type { AdminController } from '@/modules/admin/admin.controller';
import { createAdminAuthMiddleware } from '@/middleware/admin-auth';
import { rateLimit } from '@/middleware/rate-limit';
import { validate } from '@/middleware/validate';
import {
  adminCreatePromoSchema,
  adminFeedbackQuerySchema,
  adminGrantSubscriptionSchema,
  adminLoginSchema,
  adminReviewUpgradeRequestSchema,
  adminRevokeSubscriptionSchema,
  adminUpgradeRequestsQuerySchema,
  adminUserIdSchema,
  adminUsersQuerySchema,
  upgradeRequestIdSchema,
} from '@/modules/admin/admin.schema';

export function adminRoutes(controller: AdminController): Router {
  const router = Router();
  const adminAuth = createAdminAuthMiddleware();

  router.post(
    '/login',
    rateLimit({ prefix: 'admin-login', max: 10 }),
    validate(adminLoginSchema),
    controller.login,
  );

  router.use(adminAuth);
  router.get('/overview', controller.overview);
  router.get('/activity', controller.activity);
  router.get('/funnel', controller.funnel);
  router.get('/users', validate(adminUsersQuerySchema, 'query'), controller.users);
  router.get('/users/:id', validate(adminUserIdSchema, 'params'), controller.user);
  router.post(
    '/users/:id/grant-subscription',
    validate(adminUserIdSchema, 'params'),
    validate(adminGrantSubscriptionSchema),
    controller.grantSubscription,
  );
  router.post(
    '/users/:id/revoke-subscription',
    validate(adminUserIdSchema, 'params'),
    validate(adminRevokeSubscriptionSchema),
    controller.revokeSubscription,
  );
  router.get('/upgrade-requests', validate(adminUpgradeRequestsQuerySchema, 'query'), controller.upgradeRequests);
  router.post(
    '/upgrade-requests/:id/approve',
    validate(upgradeRequestIdSchema, 'params'),
    validate(adminReviewUpgradeRequestSchema),
    controller.approveUpgradeRequest,
  );
  router.post(
    '/upgrade-requests/:id/reject',
    validate(upgradeRequestIdSchema, 'params'),
    validate(adminReviewUpgradeRequestSchema),
    controller.rejectUpgradeRequest,
  );
  router.get('/promo-codes', controller.promoCodes);
  router.post('/promo-codes', validate(adminCreatePromoSchema), controller.createPromoCode);
  router.get('/feedback', validate(adminFeedbackQuerySchema, 'query'), controller.feedback);

  return router;
}
