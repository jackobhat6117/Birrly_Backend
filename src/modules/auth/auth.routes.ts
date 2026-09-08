import { Router } from 'express';
import { rateLimit } from '@/middleware/rate-limit';
import type { AuthController } from '@/modules/auth/auth.controller';

export function authRoutes(controller: AuthController): Router {
  const router = Router();

  // Strict rate limit: 10 login attempts per minute per IP
  router.post('/telegram', rateLimit({ prefix: 'auth-telegram', max: 10 }), controller.telegramLogin);

  return router;
}
