import { Router } from 'express';
import type { AnalyticsController } from '@/modules/analytics/analytics.controller';
import { validate } from '@/middleware/validate';
import { ingestEventsSchema } from '@/modules/analytics/analytics.schema';

export function analyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();
  router.post('/events', validate(ingestEventsSchema), controller.ingest);
  return router;
}
