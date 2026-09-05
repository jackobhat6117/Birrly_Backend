import type { Request, Response } from 'express';
import type { SubscriptionService } from '@/modules/subscriptions/subscription.service';
import { asyncHandler } from '@/middleware/async-handler';

export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  me = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const [access, checkout] = await Promise.all([
      this.subscriptionService.getAccess(userId),
      this.subscriptionService.getCheckoutInfo(userId),
    ]);

    res.json({
      data: {
        ...access,
        checkout,
      },
    });
  });

  upgradeRequest = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { plan } = req.body;
    const request = await this.subscriptionService.createOrGetUpgradeRequest(userId, plan);

    res.status(201).json({
      data: request,
    });
  });

  redeemPromo = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { code } = req.body;
    const result = await this.subscriptionService.redeemPromo(userId, code);
    const access = await this.subscriptionService.getAccess(userId);

    res.json({
      data: {
        ...result,
        access,
      },
    });
  });

  trial = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const access = await this.subscriptionService.startTrialIfEligible(userId);

    res.json({
      data: access,
    });
  });
}
