import type { CoachMetrics, CoachSection } from '@/modules/coach/coach.types';
import type { CoachPromptFacts } from '@/modules/coach/coach.prompt';

/**
 * Post-generation guard for AI Money Coach output. The prompt *asks* the LLM not
 * to give financial advice or invent numbers; this *enforces* it. If the model
 * slips (recommends investing, mentions a stock/crypto, or cites a money figure
 * that isn't in the source facts), the guard fails and the service hides the card
 * rather than showing advice or a fabricated number.
 *
 * Pure and deterministic so it can be evaluated directly (tests/evals).
 */

export type GuardableOutput = {
  headline: string;
  sections: CoachSection[];
};

export type GuardResult = {
  ok: boolean;
  violations: string[];
};

// Investment vehicles + advice verbs the coach must never produce. Curated to
// avoid false positives on Birrly's legitimate vocabulary: bare "debt"/"owe"
// (IOUs) and "budget"/"save"/"goal" are NOT banned — only advice to invest,
// trade instruments, or take/refinance loans. English + a little Amharic.
const FORBIDDEN_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'investment advice', re: /\binvest(?:ing|ment|ments)?\b/i },
  { label: 'stock market', re: /\b(?:stocks?|shares|equit(?:y|ies)|dividends?|bonds?|portfolio)\b/i },
  { label: 'funds', re: /\b(?:mutual fund|index fund|etf|hedge fund)\b/i },
  { label: 'crypto', re: /\b(?:crypto(?:currency)?|bitcoin|ethereum|forex)\b/i },
  { label: 'trading', re: /\b(?:day[-\s]?trading|speculat(?:e|ing|ion))\b/i },
  { label: 'loan advice', re: /\b(?:take (?:out )?a loan|get a loan|apply for a loan|refinanc(?:e|ing)|mortgage)\b/i },
  { label: 'tax advice', re: /\b(?:tax[-\s]?free|tax deduction|tax write[-\s]?off|reduce your tax)\b/i },
  { label: 'insurance product', re: /\b(?:insurance policy|buy insurance|take (?:out )?insurance)\b/i },
  { label: 'amharic investment', re: /(?:አክሲዮን|ኢንቨስት|ቢትኮይን)/ },
];

/** A money figure must be small (count/percent) or appear in the source facts. */
const MONEY_SIGNIFICANCE_THRESHOLD = 1000;

function normalizeNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').trim();
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? Math.round(value) : null;
}

/** Every numeric figure we handed the model — the only money numbers it may cite. */
export function collectAllowedNumbers(facts: CoachPromptFacts, metrics: CoachMetrics): Set<number> {
  const raw: Array<string | number | null | undefined> = [
    facts.income,
    facts.expenses,
    facts.savings,
    facts.savingsRate,
    facts.monthlyIncome,
    facts.paydayDay,
    metrics.healthScore,
    metrics.recurringAnnualCost,
    ...facts.topCategories.map((c) => c.amount),
    ...facts.largestExpenses.map((e) => e.amount),
    ...facts.categoryChanges.flatMap((c) => [c.current, c.previous]),
    ...facts.budgets.flatMap((b) => [b.amount, b.spent]),
    ...facts.savingsGoals.flatMap((g) => [g.targetAmount, g.currentAmount, g.percent]),
    ...facts.openDebts.map((d) => d.remainingAmount),
    ...facts.recurring.flatMap((r) => [r.monthlyAverage, r.annualCost]),
  ];

  const allowed = new Set<number>();
  for (const value of raw) {
    if (value === null || value === undefined) continue;
    const n = normalizeNumber(String(value));
    if (n !== null) allowed.add(n);
  }
  return allowed;
}

export function guardCoachOutput(output: GuardableOutput, allowedNumbers: Set<number>): GuardResult {
  const violations: string[] = [];
  const texts = [
    output.headline,
    ...output.sections.flatMap((s) => [s.title, s.detail, s.recommendation ?? '', s.impact ?? '']),
  ];
  const joined = texts.join('  ');

  for (const { label, re } of FORBIDDEN_PATTERNS) {
    if (re.test(joined)) {
      violations.push(`forbidden topic (${label})`);
    }
  }

  const numberTokens = joined.match(/\d[\d,]*(?:\.\d+)?/g) ?? [];
  for (const token of numberTokens) {
    const n = normalizeNumber(token);
    if (n === null || n < MONEY_SIGNIFICANCE_THRESHOLD) continue; // small counts / percentages are fine
    if (!allowedNumbers.has(n)) {
      violations.push(`invented number (${token})`);
    }
  }

  return { ok: violations.length === 0, violations };
}
