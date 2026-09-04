import { Router } from 'express';
import type { FeedbackController } from '@/modules/feedback/feedback.controller';

export function feedbackRoutes(controller: FeedbackController): Router {
  const router = Router();
  router.post('/', controller.create);
  return router;
}
