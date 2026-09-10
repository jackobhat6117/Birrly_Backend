import type { MetricsReport } from '@/modules/coach/coach.metrics';
import type { GuardableOutput } from '@/modules/coach/coach.guard';

/**
 * Golden set for the AI Money Coach (ADR 001 step 2). Two kinds of case:
 *
 * - METRIC cases pin the deterministic figures the domain computes (health score,
 *   annualized recurring cost) for a given financial snapshot.
 * - GUARD cases pin the non-advisory + no-invented-numbers contract: "must-not"
 *   outputs (recommend investing, name a stock/crypto, cite a fabricated figure)
 *   are rejected; "must-allow" outputs grounded in the supplied numbers pass.
 *
 * These run fully in CI — no LLM — because they exercise the domain math and the
 * guard, not the model. They lock in what the coach is allowed to say.
 */

export type MetricCase = {
  id: string;
  report: MetricsReport;
  budgets: Array<{ status: string }>;
  recurring: Array<{ annualCost: string }>;
  expect: { healthScore: number; recurringAnnualCost: string | null };
};

const report = (savingsRate: string, over: Partial<MetricsReport> = {}): MetricsReport => ({
  income: '40000.00',
  expenses: '20000.00',
  savings: '20000.00',
  savingsRate,
  ...over,
});

export const COACH_METRIC_CASES: MetricCase[] = [
  {
    id: 'metric-high-savings-no-budgets',
    report: report('50.00'),
    budgets: [],
    recurring: [],
    // savings 50 * 1.2 = 60 (cap) + neutral 20 = 80
    expect: { healthScore: 80, recurringAnnualCost: null },
  },
  {
    id: 'metric-savings-capped',
    report: report('78.93'),
    budgets: [],
    recurring: [],
    expect: { healthScore: 80, recurringAnnualCost: null },
  },
  {
    id: 'metric-zero-savings',
    report: report('0.00', { savings: '0.00', expenses: '40000.00' }),
    budgets: [],
    recurring: [],
    expect: { healthScore: 20, recurringAnnualCost: null },
  },
  {
    id: 'metric-negative-savings-clamped',
    report: report('-15.00', { savings: '-6000.00', expenses: '46000.00' }),
    budgets: [],
    recurring: [],
    // negative savings component clamps to 0, + neutral 20
    expect: { healthScore: 20, recurringAnnualCost: null },
  },
  {
    id: 'metric-budgets-all-ok',
    report: report('25.00'),
    budgets: [{ status: 'ok' }, { status: 'warning' }],
    recurring: [],
    // 25*1.2=30 + (2/2)*40=40 = 70
    expect: { healthScore: 70, recurringAnnualCost: null },
  },
  {
    id: 'metric-budget-half-over',
    report: report('25.00'),
    budgets: [{ status: 'over' }, { status: 'ok' }],
    recurring: [],
    // 30 + round(1/2 * 40)=20 = 50
    expect: { healthScore: 50, recurringAnnualCost: null },
  },
  {
    id: 'metric-recurring-sum',
    report: report('50.00'),
    budgets: [],
    recurring: [{ annualCost: '3600.00' }, { annualCost: '1200.00' }],
    expect: { healthScore: 80, recurringAnnualCost: '4800.00' },
  },
];

export type GuardCase = {
  id: string;
  output: GuardableOutput;
  /** Numbers the coach was allowed to cite (from the source facts). */
  allowed: number[];
  expectOk: boolean;
  note?: string;
};

const headline = (text: string): Pick<GuardableOutput, 'headline'> => ({ headline: text });
const section = (detail: string, extra: Partial<GuardableOutput['sections'][number]> = {}) => ({
  title: 'Section',
  tone: 'neutral' as const,
  detail,
  ...extra,
});

export const COACH_GUARD_CASES: GuardCase[] = [
  // --- must allow: grounded, non-advisory ---
  {
    id: 'guard-ok-grounded',
    output: {
      ...headline('You kept 78% of your income this month.'),
      sections: [section('Rent was your biggest expense at 8,000.00 ETB, unchanged from last month.')],
    },
    allowed: [8000, 40000],
    expectOk: true,
  },
  {
    id: 'guard-ok-small-numbers',
    output: {
      ...headline('Spending held steady.'),
      sections: [section('This charge showed up in 3 of the last 3 months and is worth a look.')],
    },
    allowed: [],
    expectOk: true,
    note: 'counts/percentages under the money threshold are fine',
  },
  {
    id: 'guard-ok-iou-mention',
    output: {
      ...headline('One IOU is still open.'),
      sections: [section('Abebe still owes you 2,000.00 ETB — a nudge might help.')],
    },
    allowed: [2000],
    expectOk: true,
    note: 'debt/owe vocabulary is legitimate (IOUs), not banned',
  },
  {
    id: 'guard-ok-budget-language',
    output: {
      ...headline('Food is creeping up.'),
      sections: [section('Consider a tighter cap on your food budget next month to save more.')],
    },
    allowed: [],
    expectOk: true,
    note: 'save/budget are core Birrly verbs, not investment advice',
  },
  {
    id: 'guard-ok-recurring-impact',
    output: {
      ...headline('A few small leaks.'),
      sections: [section('Two recurring charges add up over a year.', { impact: '≈ 4,800.00 ETB/yr' })],
    },
    allowed: [4800],
    expectOk: true,
  },

  // --- must reject: financial advice ---
  {
    id: 'guard-bad-invest',
    output: {
      ...headline('You have savings to spare.'),
      sections: [section('Consider investing your surplus for better returns.')],
    },
    allowed: [],
    expectOk: false,
    note: 'investment advice',
  },
  {
    id: 'guard-bad-stocks',
    output: {
      ...headline('Grow your money.'),
      sections: [section('Put your extra 8,000.00 ETB into stocks or an index fund.')],
    },
    allowed: [8000],
    expectOk: false,
    note: 'names investment vehicles',
  },
  {
    id: 'guard-bad-crypto',
    output: {
      ...headline('Big opportunity.'),
      sections: [section('You could buy Bitcoin with what you saved.')],
    },
    allowed: [],
    expectOk: false,
  },
  {
    id: 'guard-bad-loan',
    output: {
      ...headline('Short on rent.'),
      sections: [section('Take out a loan to cover the gap this month.')],
    },
    allowed: [],
    expectOk: false,
    note: 'loan advice (distinct from mentioning existing IOUs)',
  },
  {
    id: 'guard-bad-amharic-invest',
    output: {
      ...headline('ገንዘብ አለህ።'),
      sections: [section('ትርፍህን በአክሲዮን ኢንቨስት ማድረግ ትችላለህ።')],
    },
    allowed: [],
    expectOk: false,
    note: 'Amharic investment advice (አክሲዮን / ኢንቨስት)',
  },

  // --- must reject: invented numbers ---
  {
    id: 'guard-bad-invented-number',
    output: {
      ...headline('Room to save.'),
      sections: [section('Cutting back could save you 50,000.00 ETB a year.')],
    },
    allowed: [4800, 8000],
    expectOk: false,
    note: '50,000 was never in the source facts',
  },
  {
    id: 'guard-bad-rounded-number',
    output: {
      ...headline('Nice month.'),
      sections: [section('You saved about 32,000 ETB this month.')],
    },
    allowed: [31570, 40000],
    expectOk: false,
    note: 'model rounded 31,570 to 32,000 — a different (invented) figure',
  },
];
