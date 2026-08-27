import { Router } from 'express';
import type { AccountController } from '@/modules/accounts/account.controller';

export function accountRoutes(controller: AccountController): Router {
  const router = Router();
  router.get('/', controller.list);
  return router;
}
