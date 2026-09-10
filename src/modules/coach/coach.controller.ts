import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import type { CoachService } from '@/modules/coach/coach.service';
import { coachQuerySchema } from '@/modules/coach/coach.schema';
import { nowInZone } from '@/shared/utils/dates';

export class CoachController {
  constructor(private readonly coach: CoachService) {}

  analysis = asyncHandler(async (req: Request, res: Response) => {
    const query = coachQuerySchema.parse(req.query);
    const now = nowInZone(req.user!.timezone);
    const data = await this.coach.getOrGenerate(
      query.lens,
      {
        userId: req.user!.id,
        timezone: req.user!.timezone,
        language: req.user!.language,
        currency: req.user!.currency,
        monthlyIncome: req.user!.monthlyIncome,
        paydayDay: req.user!.paydayDay,
      },
      query.year ?? now.year,
      query.month ?? now.month,
      query.refresh ?? false,
    );
    res.json({ data });
  });
}
