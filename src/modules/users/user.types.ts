export type AuthenticatedUser = {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  language: string;
  currency: string;
  timezone: string;
  monthlyIncome: string | null;
  paydayDay: number | null;
  monthlySpendPlan: string | null;
};

export type TelegramIdentityInput = {
  telegramId: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  languageCode?: string;
};

export type UpdateProfileInput = {
  language?: string;
  currency?: string;
  timezone?: string;
  monthlyIncome?: string | null;
  paydayDay?: number | null;
  monthlySpendPlan?: string | null;
};
