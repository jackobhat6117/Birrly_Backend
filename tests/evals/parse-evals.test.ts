import { describe, expect, it } from 'vitest';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';
import { PARSE_CASES, type ParseCase } from './parse-cases';
import { aggregate, scoreCase, type CaseScore } from './score';

/**
 * Parser eval gate (ADR 001 step 2). Runs the rule-based parser over the golden
 * set and fails CI if any *active* case regresses. `knownGap` cases are reported
 * as backlog, not asserted — flip them to active (remove the flag) once the parser
 * or LLM handles them. Score threshold for gap cases is informational only.
 */

function run(testCase: ParseCase): CaseScore {
  return scoreCase(parseWithFallback(testCase.input), testCase.expect);
}

const activeCases = PARSE_CASES.filter((c) => !c.knownGap);
const gapCases = PARSE_CASES.filter((c) => c.knownGap);

describe('parser evals — active golden set', () => {
  it.each(activeCases.map((c) => [c.id, c] as const))('%s', (_id, testCase) => {
    const score = run(testCase);
    if (!score.pass) {
      const failed = score.fields
        .filter((f) => !f.ok)
        .map((f) => `${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`)
        .join('; ');
      throw new Error(`"${testCase.input.text}" → ${failed}`);
    }
    expect(score.pass).toBe(true);
  });
});

describe('parser evals — summary', () => {
  it('reports metrics and holds the active-set threshold at 100%', () => {
    const activeRows = activeCases.map((c) => ({ group: c.group, score: run(c) }));
    const gapRows = gapCases.map((c) => ({ group: c.group, score: run(c) }));
    const metrics = aggregate(activeRows);
    const gapMetrics = aggregate(gapRows);

    const groupLines = Object.entries(metrics.byGroup)
      .map(([group, g]) => `    ${group.padEnd(10)} ${g.fullPass}/${g.total}`)
      .join('\n');

    // Visible in CI logs — a running scoreboard of parser quality over the corpus.
    // eslint-disable-next-line no-console
    console.log(
      [
        '',
        '  Parser eval summary (rule-based / parseWithFallback)',
        `    active cases:     ${metrics.total}`,
        `    intent accuracy:  ${(metrics.intentAccuracy * 100).toFixed(1)}%`,
        `    exact pass:       ${(metrics.exactPassRate * 100).toFixed(1)}%`,
        groupLines,
        `    known gaps:       ${gapMetrics.total} (LLM/backlog) — currently passing ${gapMetrics.fullPass}/${gapMetrics.total}`,
        '',
      ].join('\n'),
    );

    // The gate: no active case may regress.
    expect(metrics.exactPassRate).toBe(1);
    expect(metrics.intentAccuracy).toBe(1);
  });

  it('flags any known gap that now passes (promote it to the active set)', () => {
    const nowPassing = gapCases.filter((c) => run(c).pass).map((c) => c.id);
    if (nowPassing.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`  Known gaps now passing — remove knownGap flag: ${nowPassing.join(', ')}`);
    }
    // Informational, never fails — gaps closing is good news, not a regression.
    expect(Array.isArray(nowPassing)).toBe(true);
  });
});
