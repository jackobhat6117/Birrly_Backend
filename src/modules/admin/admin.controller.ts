import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import {
  adminCreatePromoSchema,
  adminFeedbackQuerySchema,
  adminGrantSubscriptionSchema,
  adminLoginSchema,
  adminReviewUpgradeRequestSchema,
  adminRevokeSubscriptionSchema,
  adminUpgradeRequestsQuerySchema,
  adminUserIdSchema,
  adminUsersQuerySchema,
  upgradeRequestIdSchema,
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

  grantSubscription = asyncHandler(async (req: Request, res: Response) => {
    const params = adminUserIdSchema.parse(req.params);
    const body = adminGrantSubscriptionSchema.parse(req.body);
    const adminId = (req as any).admin?.sub;
    const result = await this.admin.grantSubscription(params.id, body, adminId);
    res.json({ data: result });
  });

  revokeSubscription = asyncHandler(async (req: Request, res: Response) => {
    const params = adminUserIdSchema.parse(req.params);
    const body = adminRevokeSubscriptionSchema.parse(req.body);
    const adminId = (req as any).admin?.sub;
    const result = await this.admin.revokeSubscription(params.id, body, adminId);
    res.json({ data: result });
  });

  upgradeRequests = asyncHandler(async (req: Request, res: Response) => {
    const query = adminUpgradeRequestsQuerySchema.parse(req.query);
    const result = await this.admin.listUpgradeRequests(query);
    res.json(result);
  });

  approveUpgradeRequest = asyncHandler(async (req: Request, res: Response) => {
    const params = upgradeRequestIdSchema.parse(req.params);
    const body = adminReviewUpgradeRequestSchema.parse(req.body);
    const adminId = (req as any).admin?.sub;
    const result = await this.admin.reviewUpgradeRequest(params.id, 'APPROVED', body.note, adminId);
    res.json({ data: result });
  });

  rejectUpgradeRequest = asyncHandler(async (req: Request, res: Response) => {
    const params = upgradeRequestIdSchema.parse(req.params);
    const body = adminReviewUpgradeRequestSchema.parse(req.body);
    const adminId = (req as any).admin?.sub;
    const result = await this.admin.reviewUpgradeRequest(params.id, 'REJECTED', body.note, adminId);
    res.json({ data: result });
  });

  promoCodes = asyncHandler(async (_req: Request, res: Response) => {
    const result = await this.admin.listPromoCodes();
    res.json({ data: result });
  });

  createPromoCode = asyncHandler(async (req: Request, res: Response) => {
    const body = adminCreatePromoSchema.parse(req.body);
    const result = await this.admin.createPromoCode({
      ...body,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    });
    res.status(201).json({ data: result });
  });

  feedback = asyncHandler(async (req: Request, res: Response) => {
    const query = adminFeedbackQuerySchema.parse(req.query);
    const result = await this.admin.listFeedback(query);
    res.json(result);
  });
}
