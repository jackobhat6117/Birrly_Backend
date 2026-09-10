export type BudgetScope = 'ADDED_ONLY' | 'ALL_TRANSACTIONS';
export type BudgetPeriodUnit = 'WEEK' | 'MONTH' | 'QUARTER' | 'YEAR';

export type BudgetCategoryRef = {
  categoryId: string;
  name: string;
  icon: string | null;
  color: string | null;
};

export type BudgetDto = {
  id: string;
  name: string;
  color: string;
  amount: string;
  spent: string;
  remaining: string;
  percent: number;
  status: 'ok' | 'warning' | 'over';
  currency: string;
  scope: BudgetScope;
  periodUnit: BudgetPeriodUnit;
  periodCount: number;
  startDate: string;
  periodStart: string;
  periodEnd: string;
  includeIncome: boolean;
  includeLentBorrowed: boolean;
  includeCategories: BudgetCategoryRef[];
  excludeCategories: BudgetCategoryRef[];
  accountIds: string[];

  // Back-compat fields for existing consumers (web dashboard / mini app cards).
  categoryId: string | null;
  categoryName: string | null;
  period: string;
};

export type CreateBudgetInput = {
  name?: string;
  color?: string;
  amount: string;
  currency?: string;
  scope?: BudgetScope;
  periodUnit?: BudgetPeriodUnit;
  periodCount?: number;
  startDate?: string;
  includeIncome?: boolean;
  includeLentBorrowed?: boolean;
  includeCategoryIds?: string[];
  excludeCategoryIds?: string[];
  accountIds?: string[];

  // Legacy single-category create (existing web/mini app forms).
  categoryId?: string;
};

export type UpdateBudgetInput = {
  name?: string;
  color?: string;
  amount?: string;
  scope?: BudgetScope;
  periodUnit?: BudgetPeriodUnit;
  periodCount?: number;
  startDate?: string;
  includeIncome?: boolean;
  includeLentBorrowed?: boolean;
  includeCategoryIds?: string[];
  excludeCategoryIds?: string[];
  accountIds?: string[];
};
