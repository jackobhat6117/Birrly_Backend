export type GroupBudgetRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export type GroupBudgetMemberDto = {
  id: string;
  userId: string;
  telegramId: string;
  displayName: string;
  username: string | null;
  role: GroupBudgetRole;
  joinedAt: string;
  totalSpent: string;
};

export type GroupBudgetExpenseDto = {
  id: string;
  groupBudgetId: string;
  amount: string;
  currency: string;
  description: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  spentAt: string;
  loggedBy: {
    id: string;
    telegramId: string;
    displayName: string;
  };
  source: string;
};

export type GroupBudgetStatus = 'ok' | 'warning' | 'over';

export type GroupBudgetDto = {
  id: string;
  name: string;
  description: string | null;
  amount: string;
  spent: string;
  remaining: string;
  percent: number;
  status: GroupBudgetStatus;
  currency: string;
  periodUnit: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  periodCount: number;
  startDate: string;
  joinToken: string;
  joinUrl: string;
  telegramChatId: string | null;
  isOwner: boolean;
  myRole: GroupBudgetRole;
  members: GroupBudgetMemberDto[];
  recentExpenses: GroupBudgetExpenseDto[];
  createdAt: string;
};

export type GroupBudgetSummaryDto = Omit<GroupBudgetDto, 'recentExpenses'>;

export type CreateGroupBudgetInput = {
  name: string;
  amount: string;
  currency?: string;
  description?: string;
  periodUnit?: 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';
  periodCount?: number;
  startDate?: string;
};

export type UpdateGroupBudgetInput = {
  name?: string;
  amount?: string;
  description?: string;
};

export type AddGroupExpenseInput = {
  amount: string;
  categoryId?: string;
  description?: string;
  spentAt?: string;
};

export type JoinGroupBudgetInput = {
  token: string;
};

export type AddMemberByTelegramIdInput = {
  telegramId: string;
  role?: GroupBudgetRole;
};
