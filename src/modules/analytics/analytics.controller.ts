import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { ingestEventsSchema } from '@/modules/analytics/analytics.schema';
import type { AnalyticsService } from '@/modules/analytics/analytics.service';

export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  ingest = asyncHandler(async (req: Request, res: Response) => {
    const input = ingestEventsSchema.parse(req.body);
    const result = await this.analytics.ingest(req.user!.id, input.events);
    res.json({ data: result });
  });
}
