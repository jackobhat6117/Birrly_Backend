import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import {
  adminFeedbackQuerySchema,
  adminLoginSchema,
  adminUserIdSchema,
  adminUsersQuerySchema,
} from '@/modules/admin/admin.schema';
import type { AdminService } from '@/modules/admin/admin.service';

export class AdminController {
  constructor(private readonly admin: AdminService) {}

  login = asyncHandler(async (req: Request, res: Response) => {
    const input = adminLoginSchema.parse(req.body);
    const result = await this.admin.login(input.email, input.password);
    res.json({ data: result });
  });

  overview = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ data: await this.admin.overview() });
  });

  activity = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ data: await this.admin.activity() });
  });

  funnel = asyncHandler(async (_req: Request, res: Response) => {
    res.json({ data: await this.admin.funnel() });
  });

  users = asyncHandler(async (req: Request, res: Response) => {
    const query = adminUsersQuerySchema.parse(req.query);
    const result = await this.admin.listUsers(query);
    res.json(result);
  });

  user = asyncHandler(async (req: Request, res: Response) => {
    const params = adminUserIdSchema.parse(req.params);
    res.json({ data: await this.admin.getUser(params.id) });
  });

  feedback = asyncHandler(async (req: Request, res: Response) => {
    const query = adminFeedbackQuerySchema.parse(req.query);
    const result = await this.admin.listFeedback(query);
    res.json(result);
  });
}
