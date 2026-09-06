export type InsightPromptData = {
  language: string;
  currency: string;
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  comparison?: {
    income: { current: string; previous: string; direction: string };
    expenses: { current: string; previous: string; direction: string };
    remaining: { current: string; previous: string; direction: string };
  };
  categoryChanges: Array<{ name: string; current: string; previous: string; direction: string }>;
  budgets: Array<{ categoryName: string; amount: string; spent: string; status: string }>;
  savingsGoals: Array<{ name: string; targetAmount: string; currentAmount: string; percent: number }>;
};

export function buildMonthlyInsightsPrompt(data: InsightPromptData): string {
  return `You are a budgeting assistant narrating a user's own numbers back to them. You do not calculate anything — every number below is already final and correct. Never invent, adjust, round differently, or estimate a number that isn't given here.

Task: write 2-4 short, specific observations about this month's money, each grounded in a number from the data below. Where useful, add one concrete, low-risk suggestion (e.g. "consider a lower cap on X category next month"). Do NOT give investment, loan, debt-restructuring, or tax advice — this is a personal budgeting app, not a financial advisor.

Tone per insight:
- "positive": something is going well (saved more, under budget, hit a goal)
- "warning": something needs attention (over budget, spent far more than usual, negative savings)
- "neutral": a plain observation, neither good nor bad

Write in this language: ${data.language} (use "en" for English, "am" for Amharic). Currency is ${data.currency} — do not convert it.

This month's totals:
- Income: ${data.income}
- Expenses: ${data.expenses}
- Savings (income minus expenses): ${data.savings}
- Savings rate: ${data.savingsRate}%
${data.comparison ? `
Compared to last month:
- Income: ${data.comparison.income.current} vs ${data.comparison.income.previous} (${data.comparison.income.direction})
- Expenses: ${data.comparison.expenses.current} vs ${data.comparison.expenses.previous} (${data.comparison.expenses.direction})
- Remaining: ${data.comparison.remaining.current} vs ${data.comparison.remaining.previous} (${data.comparison.remaining.direction})` : ''}
${data.categoryChanges.length > 0 ? `
Categories that changed the most vs last month:
${data.categoryChanges.map((c) => `- ${c.name}: ${c.current} vs ${c.previous} (${c.direction})`).join('\n')}` : ''}
${data.budgets.length > 0 ? `
Budgets this month:
${data.budgets.map((b) => `- ${b.categoryName}: spent ${b.spent} of ${b.amount} (${b.status})`).join('\n')}` : ''}
${data.savingsGoals.length > 0 ? `
Savings goals:
${data.savingsGoals.map((g) => `- ${g.name}: ${g.currentAmount} of ${g.targetAmount} (${g.percent}%)`).join('\n')}` : ''}

Return a single JSON object: { "insights": [ { "message": string, "tone": "positive"|"neutral"|"warning" } ] }. 1-4 items, each message 1-2 short sentences. JSON only, no other text.`;
}
