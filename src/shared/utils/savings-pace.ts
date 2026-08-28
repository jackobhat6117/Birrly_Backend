import { formatMoney, subtractMoney, toMoney, type MoneyInput } from '@/shared/utils/money';

export type SavingsPaceStatus = 'setup' | 'on_track' | 'behind' | 'over';
export type SavingsPaceNeed = 'income' | 'plan' | null;

export type SavingsPace = {
  status: SavingsPaceStatus;
  need: SavingsPaceNeed;
  income: string | null;
  plannedSpend: string | null;
  plannedSave: string | null;
  spent: string;
  remainingSpend: string;
  originalDaily: string | null;
  dailyNow: string;
  daysTotal: number;
  daysLeft: number;
  daysUsed: number;
  plannedToDate: string | null;
  percent: number;
};

export type SavingsPaceInput = {
  income: MoneyInput | null | undefined;
  plannedSpend: MoneyInput | null | undefined;
  spent: MoneyInput;
  daysTotal: number;
  daysLeft: number;
};

function hasAmount(value: MoneyInput | null | undefined): value is MoneyInput {
  if (value === null || value === undefined || value === '') return false;
  try {
    return toMoney(value).gt(0);
  } catch {
    return false;
  }
}

export function computeSavingsPace(input: SavingsPaceInput): SavingsPace {
  const daysTotal = Math.max(1, Math.floor(input.daysTotal));
  const daysLeft = Math.min(daysTotal, Math.max(1, Math.floor(input.daysLeft)));
  const daysUsed = daysTotal - daysLeft + 1;
  const spent = formatMoney(input.spent ?? 0);

  const income = hasAmount(input.income) ? formatMoney(input.income) : null;
  const plannedSpendInput = hasAmount(input.plannedSpend) ? formatMoney(input.plannedSpend) : null;

  if (!income) {
    return {
      status: 'setup',
      need: 'income',
      income: null,
      plannedSpend: plannedSpendInput,
      plannedSave: null,
      spent,
      remainingSpend: '0.00',
      originalDaily: null,
      dailyNow: '0.00',
      daysTotal,
      daysLeft,
      daysUsed,
      plannedToDate: null,
      percent: 0,
    };
  }

  if (!plannedSpendInput) {
    return {
      status: 'setup',
      need: 'plan',
      income,
      plannedSpend: null,
      plannedSave: null,
      spent,
      remainingSpend: '0.00',
      originalDaily: null,
      dailyNow: '0.00',
      daysTotal,
      daysLeft,
      daysUsed,
      plannedToDate: null,
      percent: 0,
    };
  }

  const plannedSpend = toMoney(plannedSpendInput).gt(toMoney(income))
    ? income
    : plannedSpendInput;
  const plannedSave = formatMoney(subtractMoney(income, plannedSpend));
  const leftover = subtractMoney(plannedSpend, spent);
  const over = leftover.lte(0);
  const remainingSpend = over ? '0.00' : formatMoney(leftover);
  const originalDaily = formatMoney(toMoney(plannedSpend).div(daysTotal));
  const dailyNow = over ? '0.00' : formatMoney(toMoney(remainingSpend).div(daysLeft));
  const plannedToDate = formatMoney(toMoney(plannedSpend).mul(daysUsed).div(daysTotal));
  const behind = !over && toMoney(spent).gt(toMoney(plannedToDate));
  const percent = Math.min(
    999,
    Math.round(toMoney(spent).div(toMoney(plannedSpend)).mul(100).toNumber()),
  );

  return {
    status: over ? 'over' : behind ? 'behind' : 'on_track',
    need: null,
    income,
    plannedSpend,
    plannedSave,
    spent,
    remainingSpend,
    originalDaily,
    dailyNow,
    daysTotal,
    daysLeft,
    daysUsed,
    plannedToDate,
    percent,
  };
}
