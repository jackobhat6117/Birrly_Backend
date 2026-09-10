/**
 * Offline LLM parser eval (ADR 001, step 2). Replays the same golden set the CI
 * gate uses (tests/evals/parse-cases.ts) against the *real LLM* parser and prints
 * a rule-vs-LLM comparison — intent accuracy, exact-field pass, per-group, and how
 * many "known gap" cases the LLM closes.
 *
 * NOT part of CI: it needs an API key, costs money, and is non-deterministic.
 * Run manually: `npm run eval:llm` (requires LLM_PROVIDER + LLM_API_KEY set).
 * Writes a timestamped JSON report to eval-reports/ for tracking over time.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '@/app/config';
import { createLlmProvider } from '@/integrations/llm/llm.provider';
import { AiInterpreter } from '@/modules/ai/ai.interpreter';
import { parseWithFallback } from '@/modules/ai/parsers/fallback-parser';
import { PARSE_CASES } from '../tests/evals/parse-cases';
import { aggregate, scoreCase, type CaseScore } from '../tests/evals/score';

const CONCURRENCY = 4;

type Row = {
  id: string;
  group: string;
  text: string;
  knownGap: boolean;
  rule: CaseScore;
  llm: CaseScore;
  llmLatencyMs: number;
};

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

async function main() {
  const provider = createLlmProvider(config.llm);
  if (!provider.isEnabled()) {
    console.error(
      'LLM provider is disabled. Set LLM_PROVIDER (e.g. gemini) and LLM_API_KEY to run this eval.',
    );
    process.exit(1);
  }

  const interpreter = new AiInterpreter(provider);
  console.log(`Running LLM parse eval over ${PARSE_CASES.length} cases (provider: ${config.llm.provider}, model: ${config.llm.model})...\n`);

  const rows = await mapWithConcurrency<(typeof PARSE_CASES)[number], Row>(PARSE_CASES, CONCURRENCY, async (testCase) => {
    const rule = scoreCase(parseWithFallback(testCase.input), testCase.expect);
    const started = Date.now();
    let llm: CaseScore;
    try {
      const predicted = await interpreter.interpret(testCase.input, { useLlm: true });
      llm = scoreCase(predicted, testCase.expect);
    } catch (error) {
      console.error(`  ! ${testCase.id} errored: ${(error as Error).message}`);
      llm = { intentMatch: false, fields: [], pass: false };
    }
    return {
      id: testCase.id,
      group: testCase.group,
      text: testCase.input.text,
      knownGap: Boolean(testCase.knownGap),
      rule,
      llm,
      llmLatencyMs: Date.now() - started,
    };
  });

  const ruleMetrics = aggregate(rows.map((r) => ({ group: r.group, score: r.rule })));
  const llmMetrics = aggregate(rows.map((r) => ({ group: r.group, score: r.llm })));
  const gapRows = rows.filter((r) => r.knownGap);
  const gapsClosedByLlm = gapRows.filter((r) => r.llm.pass).length;
  const avgLatency = Math.round(rows.reduce((sum, r) => sum + r.llmLatencyMs, 0) / rows.length);

  console.log('  Metric              Rule        LLM');
  console.log(`  intent accuracy     ${pct(ruleMetrics.intentAccuracy).padEnd(11)} ${pct(llmMetrics.intentAccuracy)}`);
  console.log(`  exact pass          ${pct(ruleMetrics.exactPassRate).padEnd(11)} ${pct(llmMetrics.exactPassRate)}`);
  console.log(`  known gaps closed   ${'-'.padEnd(11)} ${gapsClosedByLlm}/${gapRows.length}`);
  console.log(`  avg LLM latency     ${avgLatency} ms\n`);

  // Cases where rule and LLM disagree — the interesting signal.
  const disagreements = rows.filter((r) => r.rule.pass !== r.llm.pass);
  if (disagreements.length > 0) {
    console.log('  Disagreements (rule vs LLM):');
    for (const r of disagreements) {
      console.log(`    ${r.id.padEnd(26)} rule:${r.rule.pass ? 'pass' : 'fail'}  llm:${r.llm.pass ? 'pass' : 'fail'}  "${r.text}"`);
    }
    console.log('');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    provider: config.llm.provider,
    model: config.llm.model,
    total: rows.length,
    rule: ruleMetrics,
    llm: llmMetrics,
    gapsClosedByLlm,
    gapTotal: gapRows.length,
    avgLatencyMs: avgLatency,
    rows: rows.map((r) => ({ id: r.id, group: r.group, rulePass: r.rule.pass, llmPass: r.llm.pass, llmLatencyMs: r.llmLatencyMs })),
  };
  const dir = join(process.cwd(), 'eval-reports');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `llm-parse-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  console.log(`  Report written to ${file}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
