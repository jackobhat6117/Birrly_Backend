import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  updateTransactionSchema,
} from '@/modules/transactions/transaction.schema';
import type { TransactionService } from '@/modules/transactions/transaction.service';

export class TransactionController {
  constructor(private readonly transactions: TransactionService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const query = listTransactionsQuerySchema.parse(req.query);
    const result = await this.transactions.list(req.user!.id, query);
    res.json(result);
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.transactions.getById(req.user!.id, req.params.id as string);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createTransactionSchema.parse(req.body);
    const data = await this.transactions.create(
      req.user!.id,
      req.user!.currency,
      req.user!.timezone,
      input,
    );
    res.status(201).json({ data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = updateTransactionSchema.parse(req.body);
    const data = await this.transactions.update(
      req.user!.id,
      req.params.id as string,
      req.user!.timezone,
      input,
    );
    res.json({ data });
  });

  remove = asyncHandler(async (req: Request, res: Response) => {
    await this.transactions.remove(req.user!.id, req.params.id as string);
    res.status(204).send();
  });
}
