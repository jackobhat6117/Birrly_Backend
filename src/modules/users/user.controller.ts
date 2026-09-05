import type { Request, Response } from 'express';
import { asyncHandler } from '@/middleware/async-handler';
import type { UserService } from '@/modules/users/user.service';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { updateProfileSchema } from '@/modules/users/user.schema';

export class UserController {
  constructor(
    private readonly users: UserService,
    private readonly subscriptions: SubscriptionService,
  ) {}

  me = asyncHandler(async (req: Request, res: Response) => {
    const user = await this.users.getById(req.user!.id);
    res.json({ data: await this.withAccess(user) });
  });

  updateMe = asyncHandler(async (req: Request, res: Response) => {
    const input = updateProfileSchema.parse(req.body);
    const user = await this.users.updateProfile(req.user!.id, input);
    res.json({ data: await this.withAccess(user) });
  });

  private async withAccess(user: Awaited<ReturnType<UserService['getById']>>) {
    const access = await this.subscriptions.getAccess(user.id);
    return {
      ...user,
      plan: access.effectivePlan,
      entitlements: access.entitlements,
      isTrial: access.isTrial,
      daysRemaining: access.daysRemaining,
      currentPeriodEnd: access.currentPeriodEnd,
    };
  }
}
