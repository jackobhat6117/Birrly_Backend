import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import {
  createGroupBudgetSchema,
  updateGroupBudgetSchema,
  addGroupExpenseSchema,
  joinGroupBudgetSchema,
  addMemberByTelegramIdSchema,
  linkTelegramChatSchema,
} from '@/modules/group-budgets/group-budget.schema';
import type { GroupBudgetService } from '@/modules/group-budgets/group-budget.service';

export class GroupBudgetController {
  constructor(private readonly groupBudgets: GroupBudgetService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.groupBudgets.list(req.user!.id);
    res.json({ data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.groupBudgets.getById(req.params.id as string, req.user!.id);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createGroupBudgetSchema.parse(req.body);
    const data = await this.groupBudgets.create(req.user!.id, req.user!.timezone, input);
    res.status(201).json({ data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = updateGroupBudgetSchema.parse(req.body);
    const data = await this.groupBudgets.update(req.params.id as string, req.user!.id, input);
    res.json({ data });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.groupBudgets.delete(req.params.id as string, req.user!.id);
    res.status(204).send();
  });

  join = asyncHandler(async (req: Request, res: Response) => {
    const input = joinGroupBudgetSchema.parse(req.body);
    const data = await this.groupBudgets.joinByToken(input.token, req.user!.id);
    res.json({ data });
  });

  addExpense = asyncHandler(async (req: Request, res: Response) => {
    const input = addGroupExpenseSchema.parse(req.body);
    const data = await this.groupBudgets.addExpense(req.params.id as string, req.user!.id, input, 'MINI_APP');
    res.status(201).json({ data });
  });

  addMemberByTelegramId = asyncHandler(async (req: Request, res: Response) => {
    const input = addMemberByTelegramIdSchema.parse(req.body);
    const data = await this.groupBudgets.addMemberByTelegramId(
      req.params.id as string,
      req.user!.id,
      input.telegramId,
      input.role,
    );
    res.json({ data });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    await this.groupBudgets.removeMember(req.params.id as string, req.user!.id, req.params.userId as string);
    res.status(204).send();
  });

  linkTelegramChat = asyncHandler(async (req: Request, res: Response) => {
    const input = linkTelegramChatSchema.parse(req.body);
    const data = await this.groupBudgets.linkTelegramChat(req.params.id as string, req.user!.id, input.telegramChatId);
    res.json({ data });
  });
}
