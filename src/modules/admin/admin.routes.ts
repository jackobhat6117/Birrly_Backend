import { Router } from 'express';
import type { AdminController } from '@/modules/admin/admin.controller';
import { createAdminAuthMiddleware } from '@/middleware/admin-auth';
import { rateLimit } from '@/middleware/rate-limit';
import { validate } from '@/middleware/validate';
import { adminLoginSchema, adminUserIdSchema, adminUsersQuerySchema } from '@/modules/admin/admin.schema';

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

  return router;
}
