import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import { createDebtPaymentSchema, createDebtSchema } from '@/modules/debts/debt.schema';
import type { DebtService } from '@/modules/debts/debt.service';

export class DebtController {
  constructor(private readonly debts: DebtService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.debts.list(req.user!.id);
    res.json({ data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.debts.getById(req.user!.id, req.params.id as string);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createDebtSchema.parse(req.body);
    const data = await this.debts.create(req.user!.id, req.user!.currency, req.user!.timezone, input);
    res.status(201).json({ data });
  });

  pay = asyncHandler(async (req: Request, res: Response) => {
    const input = createDebtPaymentSchema.parse(req.body);
    const data = await this.debts.recordPayment(req.user!.id, req.params.id as string, input);
    res.status(201).json({ data });
  });

  history = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.debts.listPayments(req.user!.id, req.params.id as string);
    res.json({ data });
  });
}
