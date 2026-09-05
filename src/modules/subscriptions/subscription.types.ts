import type { Feature } from '@/shared/constants/features';

/** Mirrors Prisma `SubscriptionPlan`. */
export type SubscriptionPlan = 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY';

/** Mirrors Prisma `SubscriptionStatus`. */
export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED';

/** Mirrors Prisma `SubscriptionSource`. */
export type SubscriptionSource = 'SIGNUP_TRIAL' | 'TELEBIRR' | 'PROMO' | 'ADMIN';

/** Mirrors Prisma `UpgradeRequestStatus`. */
export type UpgradeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type SubscriptionAccess = {
  storedPlan: SubscriptionPlan;
  status: SubscriptionStatus;
  effectivePlan: SubscriptionPlan;
  entitlements: Record<Feature, boolean>;
  source: SubscriptionSource | null;
  currentPeriodEnd: string | null;
  isTrial: boolean;
  daysRemaining: number | null;
};

export type CheckoutInfo = {
  telebirrPhone: string;
  telebirrAccountName: string;
  monthlyPrice: string;
  yearlyPrice: string;
  currency: string;
  trialDays: number;
  trialEnabled: boolean;
};

export type UpgradeRequestDto = {
  id: string;
  referenceCode: string;
  plan: SubscriptionPlan;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
};

export type PromoRedeemResult = {
  plan: SubscriptionPlan;
  currentPeriodEnd: string;
  message: string;
};
