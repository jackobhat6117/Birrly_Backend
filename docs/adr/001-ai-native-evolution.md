# ADR 001 — Evolving Birrly into an AI-native personal finance assistant

**Status:** Accepted (direction) · 2026-09-10
**Deciders:** Product / Engineering
**Related:** [002-ai-native-data-flywheel.md](002-ai-native-data-flywheel.md), `PROJECT_ARCHITECTURE.md` §3.4, §26–30

## Context

Birrly today is a modular monolith where AI is an **interpreter**: free chat uses a
rule-based parser, Premium adds LLM parsing, and both emit the same
`StructuredCommand` that domain services execute. Postgres is the source of truth;
the LLM never writes to it. The AI Money Coach (`AI_COACH`) extended this — the
domain computes every figure, the LLM only narrates.

We want Birrly to become an **AI-native, personalised financial assistant**: one
whose core loop is understanding intent, acting safely, learning from outcomes, and
personalising over time — across Amharic and English, grounded in ETB and Ethiopian
money habits (Telebirr, cash, idir, equb).

The question this ADR settles is **what "AI-native" means for us and where we invest** —
specifically whether to collect data, train/fine-tune models, and how to do so without
breaking our money-integrity and privacy guarantees.

## Decision

**AI-native for Birrly means deepening the existing interpret→execute→learn loop —
not training foundation models.** Our moat is the data flywheel, the evals, the
personalization layer, and the trust guarantees, not model weights.

Concretely, we commit to this order of investment:

1. **Data flywheel (highest priority).** Capture every parse prediction and the user's
   confirmed/corrected outcome as labeled data. See ADR 002 (implemented).
2. **Evals before models.** Build a golden set of `message → expected StructuredCommand`
   cases (and coach snapshot → required/forbidden insights) that runs in CI, so any
   prompt or model change is measurable and safe. *(Implemented: `tests/evals/` +
   `npm run eval:parse`. **Parser evals** score `parseWithFallback` and gate CI — already
   surfaced a real Amharic gap ("ቀረኝ" phrasing). **Coach evals** pin the deterministic
   metrics and the output guard. The guard itself (`coach.guard.ts`) is now enforced by
   the service: any LLM output that gives financial advice or cites a number not in the
   source facts is discarded (card hidden), not just discouraged by the prompt. Next:
   distill captured corrections (ADR 002) into new parser cases. **LLM offline replay**
   is also implemented — `npm run eval:llm` (needs `LLM_API_KEY`) replays the golden set
   against the real LLM parser and prints a rule-vs-LLM comparison + per-case
   disagreements, writing a timestamped JSON report to `eval-reports/`. It is not in CI
   (cost/non-determinism).)*
3. **Personalization via memory + retrieval, not per-user training.** Introduce a
   `UserFinancialContext` (income cadence, the categories/merchants this user actually
   uses, goals, payday, typical ranges) and condition parsing + insights on it.
   *(Implemented for parsing: `modules/ai/user-context/` builds a cached per-user hint
   — frequent categories, merchant→category habits ("Bajaj"→transport), active goals,
   payday — injected into the LLM parser prompt via `AiParseService`. Best-effort:
   degrades to no personalization on any failure; the rule parser ignores it. Next:
   condition the coach and a general-query intent on the same context.)*
4. **Proactive assistance.** Evolve `AIInsightJob` from reactive to scheduled,
   personalised nudges (payday-aware warnings, leak alerts, goal pacing).
5. **General "ask Birrly" intent.** Answer "how am I doing?", "can I afford X?" from the
   user's own data via retrieval — still a structured, guardrailed command, never free
   DB access.
6. **Model work, only if justified.** Keep the `LLMProvider` interface swappable and stay
   on frontier models. Consider **fine-tuning a small model** only once we have volume +
   the eval set + real cost/latency pressure, and only for the narrow, high-frequency task
   (Amharic/code-mixed money parsing). The win there is cost, latency, and Amharic
   quality — not new capability. **We will not pretrain a foundation model.**

### Non-negotiables carried forward

- **LLM proposes, the domain disposes.** The more agentic Birrly becomes, the more
  absolute this rule is. No LLM path may write authoritative financial state.
- **Confirmation stays mandatory** for money-affecting intent. "AI-native" must never
  mean "silently writes to the ledger."
- **Privacy is the product.** Any training/eval data collection is opt-in, consented,
  purpose-limited, de-identified before use, and never sold. Users keep export/delete and
  "why did you say this?" transparency. (See ADR 002 for the consent gate.)
- **Cost control.** Cache aggressively, gate expensive calls behind Premium, route cheap
  tasks to cheap models, and cap per-user AI spend as we scale toward 50k+ users.

## Alternatives considered

- **Train / fine-tune our own model now.** Rejected: no eval set, insufficient volume,
  frontier models already exceed our task quality except in Amharic, and it would divert a
  small team from the flywheel that actually compounds. Revisit per step 6.
- **Let the LLM query/write the database directly (agentic DB access).** Rejected: breaks
  money integrity and tenant isolation; the structured-command boundary is the safety
  property that makes an AI assistant trustworthy with money.
- **Collect everything by default to maximise the dataset.** Rejected: conflicts with our
  privacy stance and likely Ethiopian data-protection expectations. Capture is opt-in and
  dark until a consent UX exists (ADR 002).

## Consequences

- Near-term engineering focuses on **instrumentation and evals**, which are cheap now and
  compound. ADR 002 is the first concrete step and is implemented.
- We accept a **latent, consent-gated dataset**: the capability ships off by default and is
  only switched on once consent + retention are in place — deliberately trading immediate
  data volume for trust.
- **Amharic** is recognised as our real technical frontier; our proprietary, consented
  Amharic finance corpus is what could later make a small fine-tuned model beat a generic
  large one at our specific task.
- Provider independence (the `LLMProvider` interface) is preserved so we can swap or
  self-host models without rewriting the domain.
- This ADR sets direction; each step (evals harness, `UserFinancialContext`, proactive
  jobs, general-query intent, any fine-tune) will get its own ADR when built.
