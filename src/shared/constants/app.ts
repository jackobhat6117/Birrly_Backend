export const DEFAULT_CURRENCY = 'ETB' as const;
export const DEFAULT_TIMEZONE = 'Africa/Addis_Ababa' as const;
export const DEFAULT_LANGUAGE = 'en' as const;

export const MONEY_SCALE = 2;
export const MONEY_MAX = '999999999999.99';

export const PAGINATION = {
  defaultPage: 1,
  defaultPageSize: 20,
  maxPageSize: 100,
} as const;

export const CONVERSATION_TTL_SECONDS = 10 * 60;
export const TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 24 * 60 * 60;
