import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createEqubSchema, recordEqubContributionSchema } from '@/modules/equb/equb.schema';
import type { EqubService } from '@/modules/equb/equb.service';

export class EqubController {
  constructor(private readonly equbs: EqubService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.equbs.list(req.user!.id);
    res.json({ data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.equbs.getById(req.user!.id, req.params.id as string);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createEqubSchema.parse(req.body);
    const data = await this.equbs.create(req.user!.id, req.user!.currency, req.user!.timezone, input);
    res.status(201).json({ data });
  });

  recordContribution = asyncHandler(async (req: Request, res: Response) => {
    const input = recordEqubContributionSchema.parse(req.body);
    const data = await this.equbs.recordContribution(req.user!.id, req.params.id as string, input);
    res.status(201).json({ data });
  });

  advanceCycle = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.equbs.advanceCycle(req.user!.id, req.params.id as string);
    res.json({ data });
  });

  nudge = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.equbs.nudgeMembers(req.user!.id, req.params.id as string);
    res.json({ data });
  });
}
