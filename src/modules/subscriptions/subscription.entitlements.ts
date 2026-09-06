import type { Feature } from '@/shared/constants/features';
import { FEATURE } from '@/shared/constants/features';

export type EntitlementMap = Record<Feature, boolean>;

const FREE_ENTITLEMENTS: EntitlementMap = {
  [FEATURE.AI_NATURAL_LANGUAGE]: false,
  [FEATURE.RULE_BASED_LOGGING]: true,
  [FEATURE.UNLIMITED_TRANSACTIONS]: true,
  [FEATURE.ADVANCED_REPORTS]: false,
  [FEATURE.UNLIMITED_REMINDERS]: false,
  [FEATURE.UNLIMITED_BUDGETS]: false,
  [FEATURE.UNLIMITED_SAVINGS_GOALS]: false,
  [FEATURE.SAVINGS_GOALS]: true,
  [FEATURE.BUDGETS]: true,
  [FEATURE.DEBT_TRACKING]: true,
  [FEATURE.IOU_NUDGE]: true,
  [FEATURE.EQUB]: false,
};

const PREMIUM_ENTITLEMENTS: EntitlementMap = {
  [FEATURE.AI_NATURAL_LANGUAGE]: true,
  [FEATURE.RULE_BASED_LOGGING]: true,
  [FEATURE.UNLIMITED_TRANSACTIONS]: true,
  [FEATURE.ADVANCED_REPORTS]: true,
  [FEATURE.UNLIMITED_REMINDERS]: true,
  [FEATURE.UNLIMITED_BUDGETS]: true,
  [FEATURE.UNLIMITED_SAVINGS_GOALS]: true,
  [FEATURE.SAVINGS_GOALS]: true,
  [FEATURE.BUDGETS]: true,
  [FEATURE.DEBT_TRACKING]: true,
  [FEATURE.IOU_NUDGE]: true,
  [FEATURE.EQUB]: true,
};

export function entitlementsForPlan(plan: 'FREE' | 'PREMIUM_MONTHLY' | 'PREMIUM_YEARLY'): EntitlementMap {
  if (plan === 'FREE') {
    return FREE_ENTITLEMENTS;
  }
  return PREMIUM_ENTITLEMENTS;
}
