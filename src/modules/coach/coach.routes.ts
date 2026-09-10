import { Router } from 'express';
import type { CoachController } from '@/modules/coach/coach.controller';
import { rateLimit } from '@/middleware/rate-limit';

export function coachRoutes(controller: CoachController): Router {
  const router = Router();
  // Each analysis is cached, but a forced refresh always costs a real LLM
  // call — cap how often one user can trigger that (same shape as insights).
  router.get(
    '/analysis',
    rateLimit({ prefix: 'coach-analysis', max: 15, windowMs: 60 * 60 * 1000 }),
    controller.analysis,
  );
  return router;
}
