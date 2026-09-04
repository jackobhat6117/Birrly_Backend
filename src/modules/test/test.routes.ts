import { Router } from 'express';
import type { TestController } from '@/modules/test/test.controller';
import { rateLimit } from '@/middleware/rate-limit';

export function testRoutes(controller: TestController): Router {
  const router = Router();
  router.get('/status', controller.status);
  router.post(
    '/reset-demo',
    rateLimit({ prefix: 'test-reset-demo', max: 5 }),
    controller.resetDemo,
  );
  return router;
}
