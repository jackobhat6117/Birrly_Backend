import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { contributeSavingsSchema, createSavingsGoalSchema } from '@/modules/savings/savings.schema';
import type { SavingsService } from '@/modules/savings/savings.service';

export class SavingsController {
  constructor(private readonly savings: SavingsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.savings.list(req.user!.id);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createSavingsGoalSchema.parse(req.body);
    const data = await this.savings.create(req.user!.id, input);
    res.status(201).json({ data });
  });

  contribute = asyncHandler(async (req: Request, res: Response) => {
    const input = contributeSavingsSchema.parse(req.body);
    const data = await this.savings.contribute(req.user!.id, req.params.id as string, input);
    res.json({ data });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.savings.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  });
}
