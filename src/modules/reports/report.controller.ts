import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/async-handler';
import type { ReportService } from '@/modules/reports/report.service';
import type { ReportInsightService } from '@/modules/reports/report-insight.service';
import { nowInZone } from '@/shared/utils/dates';

const monthlyQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const insightsQuerySchema = monthlyQuerySchema.extend({
  refresh: z.coerce.boolean().optional(),
});

export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly reportInsights: ReportInsightService,
  ) {}

  dashboard = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.reports.dashboard(req.user!.id, req.user!.timezone);
    res.json({ data });
  });

  monthly = asyncHandler(async (req: Request, res: Response) => {
    const query = monthlyQuerySchema.parse(req.query);
    const now = nowInZone(req.user!.timezone);
    const data = await this.reports.monthly(
      req.user!.id,
      req.user!.timezone,
      query.year ?? now.year,
      query.month ?? now.month,
    );
    res.json({ data });
  });

  expenseChange = asyncHandler(async (req: Request, res: Response) => {
    const query = monthlyQuerySchema.parse(req.query);
    const now = nowInZone(req.user!.timezone);
    const data = await this.reports.expenseChange(
      req.user!.id,
      query.year ?? now.year,
      query.month ?? now.month,
    );
    res.json({ data });
  });

  insights = asyncHandler(async (req: Request, res: Response) => {
    const query = insightsQuerySchema.parse(req.query);
    const now = nowInZone(req.user!.timezone);
    const data = await this.reportInsights.getOrGenerate(
      req.user!.id,
      req.user!.timezone,
      req.user!.language,
      req.user!.currency,
      query.year ?? now.year,
      query.month ?? now.month,
      query.refresh ?? false,
    );
    res.json({ data });
  });
}
