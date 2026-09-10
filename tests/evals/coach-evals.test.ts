import { describe, expect, it } from 'vitest';
import { computeCoachMetrics } from '@/modules/coach/coach.metrics';
import { guardCoachOutput } from '@/modules/coach/coach.guard';
import { COACH_GUARD_CASES, COACH_METRIC_CASES } from './coach-cases';

/**
 * AI Money Coach eval gate (ADR 001 step 2). Runs fully in CI — no LLM — because
 * it exercises the domain math and the output guard, not the model. It locks in
 * (a) the deterministic figures the coach reports and (b) what the coach is
 * allowed to say (no financial advice, no invented numbers).
 */

describe('coach evals — deterministic metrics', () => {
  it.each(COACH_METRIC_CASES.map((c) => [c.id, c] as const))('%s', (_id, testCase) => {
    const metrics = computeCoachMetrics(testCase.report, testCase.budgets, testCase.recurring);
    expect(metrics.healthScore).toBe(testCase.expect.healthScore);
    expect(metrics.recurringAnnualCost).toBe(testCase.expect.recurringAnnualCost);
  });
});

describe('coach evals — output guardrails', () => {
  it.each(COACH_GUARD_CASES.map((c) => [c.id, c] as const))('%s', (_id, testCase) => {
    const result = guardCoachOutput(testCase.output, new Set(testCase.allowed));
    if (result.ok !== testCase.expectOk) {
      throw new Error(
        `expected ok=${testCase.expectOk} but got ok=${result.ok} (violations: ${result.violations.join(', ') || 'none'})`,
      );
    }
    expect(result.ok).toBe(testCase.expectOk);
  });

  it('summary: every must-reject case is caught, every must-allow passes', () => {
    const rows = COACH_GUARD_CASES.map((c) => ({
      c,
      result: guardCoachOutput(c.output, new Set(c.allowed)),
    }));
    const mustReject = rows.filter((r) => !r.c.expectOk);
    const mustAllow = rows.filter((r) => r.c.expectOk);
    const caught = mustReject.filter((r) => !r.result.ok).length;
    const cleared = mustAllow.filter((r) => r.result.ok).length;

    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  Coach guard eval summary',
        `    metric cases:      ${COACH_METRIC_CASES.length}`,
        `    must-reject:       ${caught}/${mustReject.length} advice/invented-number outputs caught`,
        `    must-allow:        ${cleared}/${mustAllow.length} grounded outputs cleared`,
        '',
      ].join('\n'),
    );

    expect(caught).toBe(mustReject.length);
    expect(cleared).toBe(mustAllow.length);
  });
});
