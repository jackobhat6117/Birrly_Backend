import type { GroupBudgetRole } from '@prisma/client';

export type GroupSavingsMemberDto = {
  id: string;
  userId: string;
  telegramId: string;
  displayName: string;
  username: string | null;
  role: GroupBudgetRole;
  joinedAt: string;
  totalContributed: string;
  percentOfTotal: number;
};

export type GroupSavingsContributionDto = {
  id: string;
  groupSavingsGoalId: string;
  amount: string;
  currency: string;
  note: string | null;
  contributedAt: string;
  loggedBy: {
    id: string;
    telegramId: string;
    displayName: string;
  };
  source: string;
};

export type GroupSavingsGoalDto = {
  id: string;
  name: string;
  description: string | null;
  targetAmount: string;
  currentAmount: string;
  remaining: string;
  percent: number;
  reached: boolean;
  currency: string;
  targetDate: string | null;
  joinToken: string;
  joinUrl: string;
  telegramChatId: string | null;
  isOwner: boolean;
  myRole: GroupBudgetRole;
  members: GroupSavingsMemberDto[];
  recentContributions: GroupSavingsContributionDto[];
  createdAt: string;
};

export type GroupSavingsSummaryDto = Omit<GroupSavingsGoalDto, 'recentContributions'>;

export type CreateGroupSavingsInput = {
  name: string;
  targetAmount: string;
  currency?: string;
  description?: string;
  targetDate?: string;
};

export type UpdateGroupSavingsInput = {
  name?: string;
  targetAmount?: string;
  description?: string;
  targetDate?: string;
};

export type AddGroupContributionInput = {
  amount: string;
  note?: string;
  contributedAt?: string;
};
