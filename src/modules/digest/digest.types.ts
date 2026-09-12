/**
 * Monthly digest — the structured, LLM-agnostic payload the digest job hands to
 * the Telegram formatter. All figures are deterministic (computed by the report
 * service); the coach/insight lines are optional narration that is simply
 * omitted when the LLM is disabled or over quota. The domain never formats a
 * Telegram message — it returns this shape and the integration layer renders it.
 */
export type DigestTone = 'positive' | 'neutral' | 'warning';

export type MonthlyDigest = {
  period: { year: number; month: number };
  language: string;
  currency: string;
  /** Deterministic figures for the completed month. */
  income: string;
  expenses: string;
  savings: string;
  savingsRate: string;
  /** Up to a few narrated insight lines (empty when the LLM produced none). */
  insights: { message: string; tone: DigestTone }[];
  /** AI coach cash-flow highlight, when available. */
  coachHeadline: string | null;
  coachTip: string | null;
};
