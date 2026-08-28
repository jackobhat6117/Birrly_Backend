export const PRODUCT_EVENT_NAMES = [
  'SCREEN_VIEW',
  'TOUR_STARTED',
  'TOUR_COMPLETED',
  'TOUR_SKIPPED',
  'FEATURE_USED',
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

export const PRODUCT_SCREENS = [
  'home',
  'activity',
  'add',
  'debts',
  'more',
  'settings',
  'savings',
  'budgets',
  'reports',
  'subscription',
  'reminders',
  'categories',
] as const;

export type ProductScreen = (typeof PRODUCT_SCREENS)[number];

export const PRODUCT_FEATURES = [
  'add_transaction',
  'debt',
  'reminder',
  'savings',
  'budget',
  'report',
  'language_changed',
] as const;

export type ProductFeature = (typeof PRODUCT_FEATURES)[number];

export type SanitizedProductEvent = {
  name: ProductEventName;
  screen: string | null;
};

function isName(value: unknown): value is ProductEventName {
  return typeof value === 'string' && (PRODUCT_EVENT_NAMES as readonly string[]).includes(value);
}

function isScreen(value: unknown): value is ProductScreen {
  return typeof value === 'string' && (PRODUCT_SCREENS as readonly string[]).includes(value);
}

function isFeature(value: unknown): value is ProductFeature {
  return typeof value === 'string' && (PRODUCT_FEATURES as readonly string[]).includes(value);
}

export function sanitizeProductEvents(raw: unknown): SanitizedProductEvent[] {
  if (!Array.isArray(raw)) return [];
  const accepted: SanitizedProductEvent[] = [];

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (!isName(record.name)) continue;

    if (record.name === 'SCREEN_VIEW') {
      if (!isScreen(record.screen)) continue;
      accepted.push({ name: record.name, screen: record.screen });
      continue;
    }

    if (record.name === 'FEATURE_USED') {
      if (!isFeature(record.screen)) continue;
      accepted.push({ name: record.name, screen: record.screen });
      continue;
    }

    accepted.push({ name: record.name, screen: null });
  }

  return accepted;
}
