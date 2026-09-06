import { Router } from 'express';
import type { ReportController } from '@/modules/reports/report.controller';

export function reportRoutes(controller: ReportController): Router {
  const router = Router();
  router.get('/monthly', controller.monthly);
  router.get('/monthly/expense-change', controller.expenseChange);
  return router;
}
