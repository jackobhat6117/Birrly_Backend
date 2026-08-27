import { formatMoney, subtractMoney, toMoney, type MoneyInput } from '@/shared/utils/money';

export type MoneyDirection = 'up' | 'down' | 'flat';

export type MoneyComparison = {
  current: string;
  previous: string;
  delta: string;
  direction: MoneyDirection;
};

export function compareMoney(current: MoneyInput, previous: MoneyInput): MoneyComparison {
  const delta = subtractMoney(current, previous);
  return {
    current: formatMoney(current),
    previous: formatMoney(previous),
    delta: formatMoney(delta),
    direction: delta.gt(0) ? 'up' : delta.lt(0) ? 'down' : 'flat',
  };
}

export type BudgetStatus = 'ok' | 'warning' | 'over';

export type BudgetUsage = {
  remaining: string;
  percent: number;
  status: BudgetStatus;
};

export function budgetUsage(limit: MoneyInput, spent: MoneyInput): BudgetUsage {
  const cap = toMoney(limit);
  const used = toMoney(spent);
  const remaining = subtractMoney(cap, used);
  const percent = cap.lte(0) ? 0 : Math.round(used.div(cap).mul(100).toNumber());
  const status: BudgetStatus = remaining.lt(0) ? 'over' : percent >= 90 ? 'warning' : 'ok';
  return {
    remaining: formatMoney(remaining),
    percent,
    status,
  };
}

export type SavingsProgress = {
  remaining: string;
  percent: number;
  reached: boolean;
};

export function savingsProgress(target: MoneyInput, current: MoneyInput): SavingsProgress {
  const goal = toMoney(target);
  const saved = toMoney(current);
  const leftover = subtractMoney(goal, saved);
  const remaining = leftover.lt(0) ? formatMoney(0) : formatMoney(leftover);
  const percent = goal.lte(0) ? 0 : Math.min(100, Math.round(saved.div(goal).mul(100).toNumber()));
  return {
    remaining,
    percent,
    reached: leftover.lte(0),
  };
}
