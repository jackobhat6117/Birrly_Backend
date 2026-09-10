import type { CoachLens, RecurringExpenseCandidate } from '@/modules/coach/coach.types';

/** Bump when the prompt changes materially (see architecture §69). */
export const COACH_PROMPT_VERSION = 'v1';

export type CoachPromptFacts = {
  language: string;
  currency: string;
  monthLabel: string;
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  monthlyIncome: string | null;
  paydayDay: number | null;
  topCategories: Array<{ name: string; amount: string }>;
  largestExpenses: Array<{ category: string; description: string | null; amount: string }>;
  categoryChanges: Array<{ name: string; current: string; previous: string; direction: string }>;
  budgets: Array<{ categoryName: string; amount: string; spent: string; status: string }>;
  savingsGoals: Array<{ name: string; targetAmount: string; currentAmount: string; percent: number }>;
  openDebts: Array<{ personName: string; type: string; remainingAmount: string; dueDate: string | null }>;
  recurring: RecurringExpenseCandidate[];
};

const LENS_BRIEF: Record<CoachLens, string> = {
  cashflow:
    'Focus: cash flow. Show where money comes in and goes out this month, what is working, and 1-2 concrete, low-risk moves to keep more of each month\'s income (e.g. a tighter cap on the biggest discretionary category). Ground every point in the totals and categories below.',
  leaks:
    'Focus: money leaks. Call out repeated/recurring charges and categories that grew, ranked by cost. For each leak, use the annualized cost supplied below and suggest the smallest change with the least lifestyle impact. Do NOT invent charges — only use the recurring items and category changes listed.',
  audit:
    'Focus: a plain-language money audit. Summarize the month\'s position across spending, budgets, savings goals, and any open IOUs; name the one or two things most worth fixing next month. Only discuss what is tracked below — do not mention investments, net worth, loans, or taxes.',
};

export function buildCoachPrompt(lens: CoachLens, facts: CoachPromptFacts): string {
  const lines: string[] = [];

  lines.push(
    'You are Birrly\'s "Money Coach", narrating a user\'s own numbers back to them for a personal budgeting app in Ethiopia (currency ETB).',
    'You do not calculate anything — every number below is already final and correct. Never invent, adjust, round differently, or estimate a number that is not given here.',
    'You are NOT a financial advisor. Do not give investment, loan, debt-restructuring, tax, or product advice. Keep suggestions to the user\'s own logged spending and budgets.',
    '',
    LENS_BRIEF[lens],
    '',
    `Write in this language: ${facts.language} (use "en" for English, "am" for Amharic). Currency is ${facts.currency} — do not convert it.`,
    '',
    `Period: ${facts.monthLabel}`,
    `- Income this month: ${facts.income}`,
    `- Expenses this month: ${facts.expenses}`,
    `- Savings (income minus expenses): ${facts.savings}`,
    `- Savings rate: ${facts.savingsRate}%`,
  );

  if (facts.monthlyIncome) {
    lines.push(`- Expected monthly income on file: ${facts.monthlyIncome}`);
  }
  if (facts.paydayDay) {
    lines.push(`- Payday: day ${facts.paydayDay} of the month`);
  }

  if (facts.topCategories.length) {
    lines.push('', 'Top spending categories this month:');
    lines.push(...facts.topCategories.map((c) => `- ${c.name}: ${c.amount}`));
  }

  if (facts.categoryChanges.length) {
    lines.push('', 'Categories that changed most vs last month:');
    lines.push(
      ...facts.categoryChanges.map((c) => `- ${c.name}: ${c.current} vs ${c.previous} (${c.direction})`),
    );
  }

  if (facts.recurring.length) {
    lines.push('', 'Repeated / recurring charges (already annualized — rank leaks by these):');
    lines.push(
      ...facts.recurring.map(
        (r) =>
          `- ${r.label} (${r.categoryName}): ~${r.monthlyAverage}/mo, ≈ ${r.annualCost}/yr, seen in ${r.monthsSeen} months`,
      ),
    );
  }

  if (facts.largestExpenses.length) {
    lines.push('', 'Largest single expenses this month:');
    lines.push(
      ...facts.largestExpenses.map(
        (e) => `- ${e.amount} — ${e.description ?? e.category} (${e.category})`,
      ),
    );
  }

  if (facts.budgets.length) {
    lines.push('', 'Budgets this month:');
    lines.push(
      ...facts.budgets.map((b) => `- ${b.categoryName}: spent ${b.spent} of ${b.amount} (${b.status})`),
    );
  }

  if (facts.savingsGoals.length) {
    lines.push('', 'Savings goals:');
    lines.push(
      ...facts.savingsGoals.map(
        (g) => `- ${g.name}: ${g.currentAmount} of ${g.targetAmount} (${g.percent}%)`,
      ),
    );
  }

  if (facts.openDebts.length) {
    lines.push('', 'Open IOUs (interpersonal, no interest):');
    lines.push(
      ...facts.openDebts.map(
        (d) =>
          `- ${d.personName}: ${d.remainingAmount} (${d.type === 'OWED_TO_ME' ? 'owes you' : 'you owe'})${d.dueDate ? `, due ${d.dueDate}` : ''}`,
      ),
    );
  }

  lines.push(
    '',
    'Return a single JSON object shaped as:',
    '{ "headline": string, "sections": [ { "title": string, "tone": "positive"|"neutral"|"warning", "detail": string, "recommendation"?: string, "impact"?: string } ] }',
    'Rules: headline is one short sentence. 1-6 sections. "detail" is 1-3 short sentences grounded in a number above. "recommendation" is optional and low-risk. "impact" is optional and must echo a number from the data (e.g. "≈ 3,600 ETB/yr"). Output JSON only, no other text.',
  );

  return lines.join('\n');
}
