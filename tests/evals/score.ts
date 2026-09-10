import type { StructuredCommand } from '@/modules/ai/ai.types';

/**
 * Pure scoring for parser evals — no framework, no parser. Given a prediction and
 * an expectation, it reports what matched. Kept separate from the runner so the
 * same golden set can later be scored against the LLM parser offline, not just
 * the rule-based one in CI.
 */

/** Fields we assert on. Only those present in a case's `expect` are checked. */
export type ExpectedFields = Partial<
  Pick<
    StructuredCommand,
    'intent' | 'amount' | 'categorySlug' | 'personName' | 'debtType' | 'reminderTitle'
  >
> & {
  /** Assert the exact set of missing fields (order-insensitive) when provided. */
  missingFields?: string[];
};

export type FieldResult = {
  field: string;
  expected: unknown;
  actual: unknown;
  ok: boolean;
};

export type CaseScore = {
  intentMatch: boolean;
  fields: FieldResult[];
  /** True only when the intent and every asserted field match. */
  pass: boolean;
};

function sameStringSet(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const sorted = (xs: string[]) => [...xs].sort();
  return sorted(a).every((value, index) => value === sorted(b)[index]);
}

export function scoreCase(predicted: StructuredCommand, expected: ExpectedFields): CaseScore {
  const fields: FieldResult[] = [];

  const intentMatch = expected.intent === undefined || predicted.intent === expected.intent;
  if (expected.intent !== undefined) {
    fields.push({ field: 'intent', expected: expected.intent, actual: predicted.intent, ok: intentMatch });
  }

  const scalarFields = ['amount', 'categorySlug', 'personName', 'debtType', 'reminderTitle'] as const;
  for (const field of scalarFields) {
    const want = expected[field];
    if (want === undefined) continue;
    const got = predicted[field];
    fields.push({ field, expected: want, actual: got, ok: got === want });
  }

  if (expected.missingFields !== undefined) {
    const ok = sameStringSet(predicted.missingFields, expected.missingFields);
    fields.push({
      field: 'missingFields',
      expected: expected.missingFields,
      actual: predicted.missingFields,
      ok,
    });
  }

  const pass = intentMatch && fields.every((result) => result.ok);
  return { intentMatch, fields, pass };
}

export type AggregateMetrics = {
  total: number;
  intentCorrect: number;
  fullPass: number;
  intentAccuracy: number;
  exactPassRate: number;
  byGroup: Record<string, { total: number; fullPass: number }>;
};

export function aggregate(
  rows: Array<{ group: string; score: CaseScore }>,
): AggregateMetrics {
  const byGroup: AggregateMetrics['byGroup'] = {};
  let intentCorrect = 0;
  let fullPass = 0;

  for (const { group, score } of rows) {
    if (score.intentMatch) intentCorrect += 1;
    if (score.pass) fullPass += 1;
    byGroup[group] ??= { total: 0, fullPass: 0 };
    byGroup[group].total += 1;
    if (score.pass) byGroup[group].fullPass += 1;
  }

  const total = rows.length;
  return {
    total,
    intentCorrect,
    fullPass,
    intentAccuracy: total ? intentCorrect / total : 1,
    exactPassRate: total ? fullPass / total : 1,
    byGroup,
  };
}
