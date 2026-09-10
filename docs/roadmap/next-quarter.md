# Next Quarter — from "explains your money" to "watches it with you"

Turns Birrly's reactive AI into a proactive assistant. Each phase builds on what
already shipped (see `docs/adr/001-ai-native-evolution.md`, `002-ai-native-data-flywheel.md`).
Every task below is written to be pasted into a GitHub issue as-is; the companion
script `scripts/create-roadmap-issues.sh` creates all three via `gh`.

**Current integration state (baseline):**
- Personalized LLM parsing (`UserContextService` → `AiParseService`) — **live in the Telegram bot**, activates with an LLM key + Premium.
- Correction capture (ADR 002) — **wired in the bot**, dark until `AI_TRAINING_CAPTURE=true` + consent.
- AI Money Coach — **Mini App / web only; NOT yet in the Telegram bot** (no `/coach` command).

---

## Phase 01 — The Coach speaks first (Month 1)

**Goal:** stop waiting to be opened. Turn the existing BullMQ workers into
personalized, well-timed Telegram nudges, and bring the Coach into the chat.

**Why now:** the workers (`src/jobs/`), `NotificationService`, `CoachService`,
`CoachRepository.recurringCandidates`, and `UserContextService` all already exist —
this is composition, not new infrastructure.

### Tasks
- [ ] **`/coach` command in the Telegram bot** — call `CoachService.getOrGenerate` and format the headline + health score + top section as a Telegram message (answers "is the Coach in the chatbot?"). Gate behind `AI_COACH`.
- [ ] **CoachNudgeJob** (`src/jobs/`) — a scheduled daily job iterating active Premium users.
- [ ] **Payday-aware warning** — using `paydayDay` + remaining cash, notify when the runway is tight (e.g. ≤3 days to payday and remaining below a per-user threshold).
- [ ] **Leak alert** — when `recurringCandidates` surfaces a newly-detected recurring charge this cycle, send one nudge with its annualized cost.
- [ ] **Goal pacing** — savings goal behind pace → suggest a concrete top-up amount.
- [ ] **Condition the Coach on `UserFinancialContext`** — pass the user-context hint into the coach prompt so nudges reflect the user's own habits.
- [ ] **Idempotent + rate-limited delivery** via `NotificationService` — never more than one nudge of a kind per user per day; respect quiet hours.

### Acceptance criteria
- A Premium user with a tight payday receives exactly one Telegram nudge that day; a free user receives none.
- `/coach cashflow|leaks|audit` returns the analysis inside Telegram.
- Unit tests for the payday-threshold and goal-pacing logic; nudge idempotency test.

### Touches
`src/jobs/`, `src/integrations/telegram/telegram-update.handler.ts`, `src/modules/coach/`, `src/modules/notifications/`.

---

## Phase 02 — Ask Birrly anything (Month 2)

**Goal:** a general question intent answered from the user's own data — structured
and guardrailed, never free-form advice.

**Why now:** the guard (`coach.guard.ts`), fact-gathering (`ReportService`,
`CoachService`), and the structured-command architecture are already in place.

### Tasks
- [ ] **`ASK` intent** — extend the parser/LLM prompt (`transaction-parser.v1` → `.v2`) to route open questions to a new path (do not fabricate a financial action).
- [ ] **`AskService`** — gather the relevant facts (remaining cash, payday, budgets, goals, recent spend), have the LLM answer *grounded in those numbers only*, then run the answer through the existing guard (`guardCoachOutput`) before returning.
- [ ] **"How am I doing this month?"** → a grounded summary on demand.
- [ ] **"Can I afford X?"** → reason from remaining cash + payday, with the non-advisory disclaimer.
- [ ] **Surface in both** the Telegram bot and the Mini App.
- [ ] **Evals** — add `ask-cases` to `tests/evals/` (must-answer vs must-refuse; no invented numbers).

### Acceptance criteria
- "Can I afford a 5,000 birr phone this month?" returns a grounded yes/no with the reasoning; the guard blocks any advice or invented figure.
- New eval cases pass in CI; the "ቀረኝ"-style Amharic phrasings route to `ASK`/`QUERY_BALANCE`, not `UNKNOWN`.

### Touches
`src/modules/ai/`, `src/modules/coach/coach.guard.ts` (reuse), `src/integrations/llm/`, `tests/evals/`.

---

## Phase 03 — Switch on the flywheel (Month 3)

**Goal:** ship consent, start learning responsibly, close the first Amharic gaps,
and prove the payoff with the eval tools already built.

**Why now:** capture (ADR 002) and the eval harness are built but dark; this phase
makes them safe to turn on and demonstrates the improvement loop end-to-end.

### Tasks
- [ ] **Consent & retention** — a per-user opt-in (Mini App toggle + backend `consent` flag); capture only when the user consented **and** `AI_TRAINING_CAPTURE=true`.
- [ ] **Retention job** — purge raw captures past the retention window; de-identify (strip names/phones, IOU person-names) for any training/eval export.
- [ ] **First Amharic wins** — close the "ቀረኝ" gap and other `knownGap` cases in `fallback-parser.ts` + the LLM prompt; promote them from `knownGap` in `tests/evals/parse-cases.ts`.
- [ ] **Measure the upgrade** — run `npm run eval:llm` to quantify LLM vs rule parser; capture the report in `eval-reports/` and summarize.
- [ ] **Admin visibility** — surface capture counts + eval pass-rate in the admin dashboard.

### Acceptance criteria
- Capture happens only for users who opted in; a retention job removes rows past the window.
- The "ቀረኝ" eval case moves from `knownGap` to active and passes.
- An `eval:llm` report exists comparing rule vs LLM parser quality.

### Touches
`src/modules/ai/`, `src/modules/users/` (consent), `src/jobs/` (retention), `tests/evals/`, `src/modules/admin/`.
