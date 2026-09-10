import { addMoney, formatMoney, toMoney } from '@/shared/utils/money';
import type { CoachMetrics } from '@/modules/coach/coach.types';

export type MetricsReport = {
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
};

/**
 * Deterministic figures the client can trust without the LLM. Pure so it can be
 * evaluated directly (tests/evals/coach-evals). Health score: savings rate (up to
 * 60 pts) + budget adherence (up to 40 pts); budgets absent → a neutral 20 for
 * that half.
 */
export function computeCoachMetrics(
  report: MetricsReport,
  budgets: Array<{ status: string }>,
  recurring: Array<{ annualCost: string }>,
): CoachMetrics {
  const savingsRate = toMoney(report.savingsRate);
  const savingsComponent = Math.min(60, Math.max(0, savingsRate.mul(1.2).toNumber()));

  let budgetComponent = 20;
  if (budgets.length > 0) {
    const withinBudget = budgets.filter((b) => b.status !== 'over').length;
    budgetComponent = Math.round((withinBudget / budgets.length) * 40);
  }

  const healthScore = Math.max(0, Math.min(100, Math.round(savingsComponent + budgetComponent)));

  const recurringAnnualCost = recurring.length
    ? formatMoney(recurring.reduce((sum, r) => addMoney(sum, r.annualCost), toMoney(0)))
    : null;

  return {
    income: report.income,
    expenses: report.expenses,
    savings: report.savings,
    savingsRate: report.savingsRate,
    healthScore,
    recurringAnnualCost,
  };
}
