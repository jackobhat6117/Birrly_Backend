import { Router } from 'express';
import type { UserController } from '@/modules/users/user.controller';
import { validate } from '@/middleware/validate';
import { updateProfileSchema } from '@/modules/users/user.schema';

export function userRoutes(controller: UserController): Router {
  const router = Router();
  router.get('/me', controller.me);
  router.patch('/me', validate(updateProfileSchema), controller.updateMe);
  return router;
}
