export type BudgetDto = {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: string;
  spent: string;
  remaining: string;
  percent: number;
  status: 'ok' | 'warning' | 'over';
  currency: string;
  period: string;
  startDate: string;
};

export type CreateBudgetInput = {
  categoryId: string;
  amount: string;
  currency?: string;
};

export type UpdateBudgetInput = {
  amount: string;
};
