import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import {
  createGroupSavingsSchema,
  updateGroupSavingsSchema,
  addGroupContributionSchema,
  joinGroupSavingsSchema,
  addMemberByTelegramIdSchema,
  linkTelegramChatSchema,
} from '@/modules/group-savings/group-savings.schema';
import type { GroupSavingsService } from '@/modules/group-savings/group-savings.service';

export class GroupSavingsController {
  constructor(private readonly groupSavings: GroupSavingsService) {}

  list = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.groupSavings.list(req.user!.id);
    res.json({ data });
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await this.groupSavings.getById(req.params.id as string, req.user!.id);
    res.json({ data });
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    const input = createGroupSavingsSchema.parse(req.body);
    const data = await this.groupSavings.create(req.user!.id, input, req.user!.timezone);
    res.status(201).json({ data });
  });

  update = asyncHandler(async (req: Request, res: Response) => {
    const input = updateGroupSavingsSchema.parse(req.body);
    const data = await this.groupSavings.update(req.params.id as string, req.user!.id, input, req.user!.timezone);
    res.json({ data });
  });

  delete = asyncHandler(async (req: Request, res: Response) => {
    await this.groupSavings.delete(req.params.id as string, req.user!.id);
    res.status(204).send();
  });

  join = asyncHandler(async (req: Request, res: Response) => {
    const input = joinGroupSavingsSchema.parse(req.body);
    const data = await this.groupSavings.joinByToken(input.token, req.user!.id);
    res.json({ data });
  });

  addContribution = asyncHandler(async (req: Request, res: Response) => {
    const input = addGroupContributionSchema.parse(req.body);
    const data = await this.groupSavings.addContribution(req.params.id as string, req.user!.id, input, 'MINI_APP');
    res.status(201).json({ data });
  });

  addMemberByTelegramId = asyncHandler(async (req: Request, res: Response) => {
    const input = addMemberByTelegramIdSchema.parse(req.body);
    const data = await this.groupSavings.addMemberByTelegramId(
      req.params.id as string,
      req.user!.id,
      input.telegramId,
      input.role,
    );
    res.json({ data });
  });

  removeMember = asyncHandler(async (req: Request, res: Response) => {
    await this.groupSavings.removeMember(req.params.id as string, req.user!.id, req.params.userId as string);
    res.status(204).send();
  });

  linkTelegramChat = asyncHandler(async (req: Request, res: Response) => {
    const input = linkTelegramChatSchema.parse(req.body);
    const data = await this.groupSavings.linkTelegramChat(req.params.id as string, req.user!.id, input.telegramChatId);
    res.json({ data });
  });
}
