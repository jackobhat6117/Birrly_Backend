import { Router } from 'express';
import type { ReportController } from '@/modules/reports/report.controller';
import { rateLimit } from '@/middleware/rate-limit';

export function reportRoutes(controller: ReportController): Router {
  const router = Router();
  router.get('/monthly', controller.monthly);
  router.get('/monthly/expense-change', controller.expenseChange);
  // Insights are LLM-backed and cached, but a forced refresh always costs a
  // real call — cap how often one user can trigger that.
  router.get(
    '/monthly/insights',
    rateLimit({ prefix: 'report-insights', max: 10, windowMs: 60 * 60 * 1000 }),
    controller.insights,
  );
  return router;
}
