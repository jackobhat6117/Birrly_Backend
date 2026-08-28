import type { SavingsPace } from '@/shared/utils/savings-pace';

export type SavingsGoalDto = {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  remaining: string;
  percent: number;
  reached: boolean;
  currency: string;
  createdAt: string;
};

export type CreateSavingsGoalInput = {
  name: string;
  targetAmount: string;
  currency?: string;
};

export type ContributeSavingsInput = {
  amount: string;
};

export type { SavingsPace, SavingsPaceNeed, SavingsPaceStatus } from '@/shared/utils/savings-pace';

export type SavingsPaceDto = SavingsPace & {
  currency: string;
};

export type UpdateSavingsPaceInput = {
  plannedSpend: string;
};
