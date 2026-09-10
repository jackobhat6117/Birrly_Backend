# ADR 002 — AI data flywheel: capture parse predictions and their outcomes as labeled data

**Status:** Accepted · Implemented 2026-09-10
**Deciders:** Product / Engineering
**Related:** [001-ai-native-evolution.md](001-ai-native-evolution.md)

## Context

To improve AI parsing and the assistant over time (ADR 001, step 1), we need a
**proprietary, labeled dataset** of real Birrly interactions — especially Amharic and
code-mixed money messages, which frontier models handle poorly. The gold signal already
flows through the system and is currently discarded: when a user sends `350 ምሳ`, the
parser predicts a `StructuredCommand`, the user confirms or corrects it, and that
confirmation/correction is a perfect `(input → correct output)` label.

An `ai_interactions` table already existed but stored only aggregate counts
(intent/success/provider/latency) and was written **nowhere** — only read by the admin
dashboard. It was not capturing the label signal.

This data is personal and financial (message text, amounts, person names in IOUs), so
collecting it must respect our privacy stance (ADR 001): opt-in, consented, de-identified
before training, never sold.

## Decision

Turn `ai_interactions` into a **labeled-example table** and capture the prediction plus its
resolved outcome, behind a consent gate.

**Schema** (`prisma/schema.prisma`, migration `..._ai_interaction_labels`) adds to
`AiInteraction`: `inputText`, `language`, `predictedCommand` (JSON), `finalCommand` (JSON),
`outcome` (`CONFIRMED` | `EDITED` | `CANCELED`), and `corrected` (bool), plus an
`[outcome, corrected]` index.

- A **CONFIRMED** row with `finalCommand === predictedCommand` is a **positive example**.
- An **EDITED** row (or CONFIRMED where final ≠ predicted) is a **gold correction**.
- A **CANCELED** row is a soft negative.

**Capture pipeline (Telegram chat, first surface):**
- `AiInteractionService.recordParse(...)` is called when a parse reaches the confirmation
  step; it stores the prediction and returns an id.
- The id rides along in the `PendingConversation` (Redis).
- On **Confirm** → `recordOutcome(id, 'CONFIRMED', predicted, final)`.
- On **Cancel** → `recordOutcome(id, 'CANCELED')`.

**Consent gate.** All capture is a **no-op unless `AI_TRAINING_CAPTURE=true`** (env →
`config.ai.trainingCaptureEnabled`), which defaults to **false**. The plumbing ships dark
and is only switched on once a user-facing consent + retention policy exists.

**Resilience.** Every capture call is best-effort and wrapped in try/catch: recording a
label must never break or slow the user's actual action.

## Alternatives considered

- **Log raw messages to files/analytics.** Rejected: loses the structured prediction↔final
  pairing that makes the data useful for evals/fine-tuning, and is harder to govern for
  privacy.
- **Capture at parse time only (no outcome).** Rejected: predictions without the confirmed
  truth are unlabeled; the outcome is the whole value.
- **On by default to maximise volume.** Rejected: violates the privacy stance. Off until
  consented.
- **Capture Mini App edits in this step too.** *(Now implemented.)* A soft link
  (`Transaction.aiInteractionId`, no FK) ties an AI-created transaction to its parse; the
  Telegram commit sets it. When such a transaction is later edited (`TransactionService.update`
  changes amount/category/description/date), the service records an `EDITED`/`corrected`
  outcome with the new values — the richest correction signal. Still best-effort and
  gated by `AI_TRAINING_CAPTURE`. Manually-entered transactions have no link, so their
  edits are (correctly) not treated as corrections.

## Consequences

- We now have the **capability** to build a labeled Birrly corpus; actual collection waits
  on consent UX. Until then behaviour is unchanged (flag off).
- The dataset directly feeds ADR 001's **evals** (score predictions vs. confirmed truth)
  and a future **Amharic fine-tune**.
- Payloads contain personal/financial data. Before enabling in production we must add:
  explicit opt-in, a retention window, and de-identification (strip names/phones, IOU
  person-names) for any training/eval export. These are prerequisites, tracked separately.
- Next increments: capture Mini App transaction edits as corrections; capture `UNKNOWN`
  parses as negatives; add the CI evals harness that consumes this data.
