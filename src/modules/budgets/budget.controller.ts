import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createBudgetSchema, listBudgetsQuerySchema, updateBudgetSchema } from '@/modules/budgets/budget.schema';
import type { BudgetService } from '@/modules/budgets/budget.service';

export class BudgetController {
  constructor(private readonly budgets: BudgetService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = listBudgetsQuerySchema.parse(req.query);
    const data = await this.budgets.list(req.user!.id, req.user!.timezone, query.year, query.month);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createBudgetSchema.parse(req.body);
    const data = await this.budgets.create(req.user!.id, req.user!.timezone, input);
    res.status(201).json({ data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = updateBudgetSchema.parse(req.body);
    const data = await this.budgets.update(req.user!.id, req.params.id as string, input);
    res.json({ data });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.budgets.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  });
}
