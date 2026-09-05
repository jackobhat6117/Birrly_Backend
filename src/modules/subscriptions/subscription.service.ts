import { DateTime } from 'luxon';
import type { DbClient } from '@/database/prisma';
import { entitlementsForPlan } from '@/modules/subscriptions/subscription.entitlements';
import { AppError, ConflictError, ERROR_CODE, NotFoundError } from '@/shared/errors/app-error';
import type { Feature } from '@/shared/constants/features';
import { DEFAULT_CURRENCY, DEFAULT_TIMEZONE } from '@/shared/constants/app';
import type {
  CheckoutInfo,
  PromoRedeemResult,
  SubscriptionAccess,
  SubscriptionPlan,
  SubscriptionSource,
  SubscriptionStatus,
  UpgradeRequestDto,
  UpgradeRequestStatus,
} from './subscription.types';

const TRIAL_DURATION_DAYS = 7;

export type SubscriptionCheckoutConfig = {
  telebirrPhone: string;
  telebirrAccountName: string;
  monthlyPriceEtb: string;
  yearlyPriceEtb: string;
};

function generateReferenceCode(): string {
  const digits = Math.floor(10000 + Math.random() * 90000);
  return `BIRRLY-${digits}`;
}

export class SubscriptionService {
  constructor(
    private readonly db: DbClient,
    private readonly checkout: SubscriptionCheckoutConfig = {
      telebirrPhone: '+251 91 100 0000',
      telebirrAccountName: 'Birrly',
      monthlyPriceEtb: '200.00',
      yearlyPriceEtb: '2000.00',
    },
  ) {}

  async ensureFreePlan(userId: string): Promise<void> {
    await this.db.subscription.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
      },
    });
  }

  async canAccess(userId: string, feature: Feature): Promise<boolean> {
    const access = await this.getAccess(userId);
    return access.entitlements[feature];
  }

  async assertCanAccess(userId: string, feature: Feature): Promise<void> {
    const allowed = await this.canAccess(userId, feature);
    if (!allowed) {
      throw new AppError(
        ERROR_CODE.SUBSCRIPTION_REQUIRED,
        'This feature requires a premium subscription.',
        402,
      );
    }
  }

  async getForUser(userId: string) {
    return this.db.subscription.findUnique({
      where: { userId },
    });
  }

  async getAccess(userId: string): Promise<SubscriptionAccess> {
    const subscription = await this.getForUser(userId);
    const storedPlan = subscription?.plan ?? 'FREE';
    const status = subscription?.status ?? 'ACTIVE';
    const now = new Date();

    let isExpired = false;
    let daysRemaining: number | null = null;

    if (subscription?.currentPeriodEnd) {
      const end = subscription.currentPeriodEnd;
      const diffMs = end.getTime() - now.getTime();
      if (diffMs <= 0) {
        isExpired = true;
      } else {
        daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      }
    }

    const effectivePlan: SubscriptionPlan = status === 'ACTIVE' && !isExpired ? storedPlan : 'FREE';
    const isTrial = subscription?.source === 'SIGNUP_TRIAL' && !isExpired && effectivePlan !== 'FREE';

    return {
      storedPlan,
      status: isExpired ? 'EXPIRED' : status,
      effectivePlan,
      entitlements: entitlementsForPlan(effectivePlan),
      source: subscription?.source ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
      isTrial,
      daysRemaining,
    };
  }

  async getCheckoutInfo(userId: string): Promise<CheckoutInfo & { activeRequest: UpgradeRequestDto | null }> {
    const activeRequest = await this.db.subscriptionUpgradeRequest.findFirst({
      where: { userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      telebirrPhone: this.checkout.telebirrPhone,
      telebirrAccountName: this.checkout.telebirrAccountName,
      monthlyPrice: this.checkout.monthlyPriceEtb,
      yearlyPrice: this.checkout.yearlyPriceEtb,
      currency: DEFAULT_CURRENCY,
      trialDays: TRIAL_DURATION_DAYS,
      trialEnabled: true,
      activeRequest: activeRequest
        ? {
            id: activeRequest.id,
            referenceCode: activeRequest.referenceCode,
            plan: activeRequest.plan,
            amount: activeRequest.amount.toFixed(2),
            currency: activeRequest.currency,
            status: activeRequest.status,
            createdAt: activeRequest.createdAt.toISOString(),
          }
        : null,
    };
  }

  async createOrGetUpgradeRequest(userId: string, plan: SubscriptionPlan): Promise<UpgradeRequestDto> {
    // Check if there's already a pending request for this user with same plan
    const existing = await this.db.subscriptionUpgradeRequest.findFirst({
      where: { userId, status: 'PENDING', plan },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      return {
        id: existing.id,
        referenceCode: existing.referenceCode,
        plan: existing.plan,
        amount: existing.amount.toFixed(2),
        currency: existing.currency,
        status: existing.status,
        createdAt: existing.createdAt.toISOString(),
      };
    }

    const amount =
      plan === 'PREMIUM_YEARLY' ? this.checkout.yearlyPriceEtb : this.checkout.monthlyPriceEtb;
    let referenceCode = generateReferenceCode();

    // Ensure uniqueness
    for (let i = 0; i < 5; i++) {
      const collision = await this.db.subscriptionUpgradeRequest.findUnique({
        where: { referenceCode },
      });
      if (!collision) break;
      referenceCode = generateReferenceCode();
    }

    const created = await this.db.subscriptionUpgradeRequest.create({
      data: {
        userId,
        referenceCode,
        plan,
        amount,
        currency: DEFAULT_CURRENCY,
        status: 'PENDING',
      },
    });

    await this.db.auditLog.create({
      data: {
        userId,
        action: 'UPGRADE_REQUEST_CREATED',
        entityType: 'SUBSCRIPTION_UPGRADE_REQUEST',
        entityId: created.id,
        metadata: { referenceCode, plan, amount },
      },
    });

    return {
      id: created.id,
      referenceCode: created.referenceCode,
      plan: created.plan,
      amount: created.amount.toFixed(2),
      currency: created.currency,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async redeemPromo(userId: string, rawCode: string): Promise<PromoRedeemResult> {
    const code = rawCode.trim().toUpperCase();
    const promo = await this.db.promoCode.findUnique({
      where: { code },
    });

    if (!promo || !promo.active) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'Invalid or inactive promo code.', 400);
    }

    if (promo.expiresAt && promo.expiresAt < new Date()) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'This promo code has expired.', 400);
    }

    if (promo.usedCount >= promo.maxUses) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'This promo code has reached its maximum usage limit.', 400);
    }

    const existingSub = await this.db.subscription.findUnique({ where: { userId } });
    const now = DateTime.now().setZone(DEFAULT_TIMEZONE);
    let startDate = now;

    if (existingSub?.currentPeriodEnd && existingSub.currentPeriodEnd > now.toJSDate() && existingSub.status === 'ACTIVE') {
      startDate = DateTime.fromJSDate(existingSub.currentPeriodEnd).setZone(DEFAULT_TIMEZONE);
    }

    const newPeriodEnd = startDate.plus({ days: promo.durationDays }).toJSDate();

    await this.db.$transaction([
      this.db.promoCode.update({
        where: { id: promo.id },
        data: { usedCount: { increment: 1 } },
      }),
      this.db.subscription.upsert({
        where: { userId },
        update: {
          plan: promo.plan,
          status: 'ACTIVE',
          source: 'PROMO',
          currentPeriodEnd: newPeriodEnd,
        },
        create: {
          userId,
          plan: promo.plan,
          status: 'ACTIVE',
          source: 'PROMO',
          currentPeriodEnd: newPeriodEnd,
        },
      }),
      this.db.auditLog.create({
        data: {
          userId,
          action: 'PROMO_REDEEMED',
          entityType: 'PROMO_CODE',
          entityId: promo.id,
          metadata: { code, durationDays: promo.durationDays, newPeriodEnd: newPeriodEnd.toISOString() },
        },
      }),
    ]);

    return {
      plan: promo.plan,
      currentPeriodEnd: newPeriodEnd.toISOString(),
      message: `Promo code applied successfully! Enjoy ${promo.durationDays} days of Premium.`,
    };
  }

  async startTrialIfEligible(userId: string): Promise<SubscriptionAccess> {
    const existing = await this.db.subscription.findUnique({ where: { userId } });

    if (existing && (existing.plan !== 'FREE' || existing.source === 'SIGNUP_TRIAL')) {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, 'User is not eligible for a free trial.', 400);
    }

    const periodEnd = DateTime.now().setZone(DEFAULT_TIMEZONE).plus({ days: TRIAL_DURATION_DAYS }).toJSDate();

    await this.db.subscription.upsert({
      where: { userId },
      update: {
        plan: 'PREMIUM_MONTHLY',
        status: 'ACTIVE',
        source: 'SIGNUP_TRIAL',
        currentPeriodEnd: periodEnd,
      },
      create: {
        userId,
        plan: 'PREMIUM_MONTHLY',
        status: 'ACTIVE',
        source: 'SIGNUP_TRIAL',
        currentPeriodEnd: periodEnd,
      },
    });

    await this.db.auditLog.create({
      data: {
        userId,
        action: 'TRIAL_STARTED',
        entityType: 'SUBSCRIPTION',
        metadata: { durationDays: TRIAL_DURATION_DAYS, currentPeriodEnd: periodEnd.toISOString() },
      },
    });

    return this.getAccess(userId);
  }

  async grantSubscription(
    userId: string,
    options: {
      plan: SubscriptionPlan;
      months?: number;
      note?: string;
      source?: SubscriptionSource;
      adminId?: string;
    },
  ) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'User not found.');
    }

    const months = options.months ?? (options.plan === 'PREMIUM_YEARLY' ? 12 : 1);
    const newPeriodEnd = DateTime.now().setZone(DEFAULT_TIMEZONE).plus({ months }).toJSDate();

    const result = await this.db.$transaction(async (tx) => {
      const sub = await tx.subscription.upsert({
        where: { userId },
        update: {
          plan: options.plan,
          status: 'ACTIVE',
          source: options.source ?? 'ADMIN',
          currentPeriodEnd: newPeriodEnd,
        },
        create: {
          userId,
          plan: options.plan,
          status: 'ACTIVE',
          source: options.source ?? 'ADMIN',
          currentPeriodEnd: newPeriodEnd,
        },
      });

      // Auto-approve any pending upgrade request for this user
      await tx.subscriptionUpgradeRequest.updateMany({
        where: { userId, status: 'PENDING' },
        data: {
          status: 'APPROVED',
          adminNote: options.note ?? 'Approved via manual grant',
          reviewedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'SUBSCRIPTION_GRANTED',
          entityType: 'SUBSCRIPTION',
          entityId: sub.id,
          metadata: {
            plan: options.plan,
            months,
            note: options.note,
            adminId: options.adminId,
            currentPeriodEnd: newPeriodEnd.toISOString(),
          },
        },
      });

      return sub;
    });

    return result;
  }

  async revokeSubscription(userId: string, adminId?: string, note?: string) {
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'User not found.');
    }

    const sub = await this.db.subscription.upsert({
      where: { userId },
      update: {
        plan: 'FREE',
        status: 'ACTIVE',
        source: 'ADMIN',
        currentPeriodEnd: null,
      },
      create: {
        userId,
        plan: 'FREE',
        status: 'ACTIVE',
        source: 'ADMIN',
      },
    });

    await this.db.auditLog.create({
      data: {
        userId,
        action: 'SUBSCRIPTION_REVOKED',
        entityType: 'SUBSCRIPTION',
        entityId: sub.id,
        metadata: { adminId, note },
      },
    });

    return sub;
  }

  async listUpgradeRequests(query: {
    status?: UpgradeRequestStatus;
    page?: number;
    pageSize?: number;
    userId?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };

    const [total, rows] = await Promise.all([
      this.db.subscriptionUpgradeRequest.count({ where }),
      this.db.subscriptionUpgradeRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              telegramUsername: true,
              telegramId: true,
            },
          },
        },
      }),
    ]);

    return {
      data: rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        referenceCode: r.referenceCode,
        plan: r.plan,
        amount: r.amount.toFixed(2),
        currency: r.currency,
        status: r.status,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        user: {
          id: r.user.id,
          name: [r.user.firstName, r.user.lastName].filter(Boolean).join(' ') || 'Unknown',
          telegramUsername: r.user.telegramUsername,
          telegramId: r.user.telegramId,
        },
      })),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async reviewUpgradeRequest(
    requestId: string,
    status: 'APPROVED' | 'REJECTED',
    note?: string,
    adminId?: string,
  ) {
    const request = await this.db.subscriptionUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundError(ERROR_CODE.USER_NOT_FOUND, 'Upgrade request not found.');
    }

    if (request.status !== 'PENDING') {
      throw new AppError(ERROR_CODE.VALIDATION_FAILED, `Upgrade request is already ${request.status}.`, 400);
    }

    if (status === 'APPROVED') {
      await this.grantSubscription(request.userId, {
        plan: request.plan,
        note: note ?? `Approved reference code ${request.referenceCode}`,
        source: 'TELEBIRR',
        adminId,
      });
    } else {
      await this.db.subscriptionUpgradeRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          adminNote: note,
          reviewedAt: new Date(),
        },
      });

      await this.db.auditLog.create({
        data: {
          userId: request.userId,
          action: 'UPGRADE_REQUEST_REJECTED',
          entityType: 'SUBSCRIPTION_UPGRADE_REQUEST',
          entityId: requestId,
          metadata: { adminId, note, referenceCode: request.referenceCode },
        },
      });
    }

    return this.db.subscriptionUpgradeRequest.findUnique({
      where: { id: requestId },
    });
  }

  async listPromoCodes() {
    const codes = await this.db.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return codes.map((c) => ({
      id: c.id,
      code: c.code,
      plan: c.plan,
      durationDays: c.durationDays,
      maxUses: c.maxUses,
      usedCount: c.usedCount,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      active: c.active,
      note: c.note,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  async createPromoCode(data: {
    code: string;
    plan?: SubscriptionPlan;
    durationDays: number;
    maxUses?: number;
    expiresAt?: Date;
    note?: string;
  }) {
    const code = data.code.trim().toUpperCase();
    const existing = await this.db.promoCode.findUnique({ where: { code } });
    if (existing) {
      throw new ConflictError('A promo code with this name already exists.');
    }

    const created = await this.db.promoCode.create({
      data: {
        code,
        plan: data.plan ?? 'PREMIUM_MONTHLY',
        durationDays: data.durationDays,
        maxUses: data.maxUses ?? 100,
        expiresAt: data.expiresAt,
        note: data.note,
        active: true,
      },
    });

    return {
      id: created.id,
      code: created.code,
      plan: created.plan,
      durationDays: created.durationDays,
      maxUses: created.maxUses,
      usedCount: created.usedCount,
      expiresAt: created.expiresAt?.toISOString() ?? null,
      active: created.active,
      note: created.note,
      createdAt: created.createdAt.toISOString(),
    };
  }
}
