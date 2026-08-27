import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import type { AccountService } from '@/modules/accounts/account.service';

export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.accounts.list(req.user!.id);
    res.json({ data });
  });
}
