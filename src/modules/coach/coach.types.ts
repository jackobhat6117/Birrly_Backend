/**
 * AI Money Coach — a premium lens over the user's own numbers. The domain
 * computes every figure (health score, annualized costs, trends); the LLM only
 * organizes and narrates them into sections. It never writes to the database
 * and never invents a number that wasn't handed to it.
 */

export const COACH_LENSES = ['cashflow', 'leaks', 'audit'] as const;
export type CoachLens = (typeof COACH_LENSES)[number];

export type SectionTone = 'positive' | 'neutral' | 'warning';

/** One narrated section produced by the LLM from grounded facts. */
export type CoachSection = {
  title: string;
  tone: SectionTone;
  detail: string;
  recommendation?: string;
  /** Grounded impact label, e.g. "≈ 3,600 ETB/yr" — only ever echoes a fact we supplied. */
  impact?: string;
};

/** Deterministic figures the service computes and the client can trust as-is. */
export type CoachMetrics = {
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  /** 0–100 cash-flow health, computed from savings rate + budget adherence (not the LLM). */
  healthScore: number;
  /** Sum of detected recurring/subscription-like spend, annualized. */
  recurringAnnualCost: string | null;
};

export type CoachAnalysisDto = {
  lens: CoachLens;
  period: { year: number; month: number };
  headline: string;
  metrics: CoachMetrics;
  sections: CoachSection[];
  /** Fixed non-advisory notice — this is budgeting analysis, not financial advice. */
  disclaimer: string;
  generatedAt: string;
};

/** A repeated expense that looks like a subscription / recurring leak. */
export type RecurringExpenseCandidate = {
  label: string;
  categoryName: string;
  monthsSeen: number;
  occurrences: number;
  monthlyAverage: string;
  annualCost: string;
};
