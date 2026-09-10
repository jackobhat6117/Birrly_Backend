#!/usr/bin/env bash
#
# Creates the next-quarter roadmap as GitHub issues (one per phase).
# Run once after installing + authenticating gh:
#
#   brew install gh && gh auth login             # first time only
#   bash scripts/create-roadmap-issues.sh        # dry run: lists what it would create
#   APPLY=1 bash scripts/create-roadmap-issues.sh  # actually create the issues
#
# NOTE: each APPLY run creates NEW issues — run the APPLY step only once.
set -euo pipefail

REPO="jackobhat6117/Birrly_Backend"
APPLY="${APPLY:-0}"

if [[ "$APPLY" == "1" ]] && ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found. Install it (brew install gh) and run 'gh auth login' first." >&2
  exit 1
fi

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

cat > "$workdir/p1.md" <<'EOF'
**Goal:** turn the existing BullMQ workers into personalized, well-timed Telegram nudges, and bring the AI Money Coach into the chat.

Builds on existing pieces: CoachService, CoachRepository.recurringCandidates, NotificationService, UserContextService.

### Tasks
- [ ] `/coach` command in the Telegram bot — call CoachService.getOrGenerate, format headline + health score + top section; gate behind AI_COACH
- [ ] CoachNudgeJob (src/jobs/) — scheduled daily, iterating active Premium users
- [ ] Payday-aware warning — using paydayDay + remaining cash (<= 3 days & below threshold)
- [ ] Leak alert — newly-detected recurring charge -> one nudge with annualized cost
- [ ] Goal pacing — savings goal behind pace -> suggest a top-up amount
- [ ] Condition the Coach on UserFinancialContext (pass the hint into the coach prompt)
- [ ] Idempotent + rate-limited delivery via NotificationService; respect quiet hours

### Acceptance
- Premium user with a tight payday gets exactly one nudge that day; free user gets none
- `/coach cashflow|leaks|audit` returns the analysis inside Telegram
- Unit tests for payday-threshold + goal-pacing; nudge idempotency test

Touches: src/jobs/, src/integrations/telegram/, src/modules/coach/, src/modules/notifications/
EOF

cat > "$workdir/p2.md" <<'EOF'
**Goal:** a general question intent answered from the user's own data — structured and guardrailed, never free-form advice.

Reuses: coach.guard.ts, ReportService/CoachService fact-gathering, the structured-command architecture.

### Tasks
- [ ] ASK intent — extend the LLM parser prompt (transaction-parser.v1 -> .v2) to route open questions without fabricating an action
- [ ] AskService — gather facts (remaining cash, payday, budgets, goals, recent spend); LLM answers grounded in those numbers only; run through guardCoachOutput
- [ ] "How am I doing this month?" -> grounded summary on demand
- [ ] "Can I afford X?" -> reason from remaining cash + payday, with the non-advisory disclaimer
- [ ] Surface in both the Telegram bot and the Mini App
- [ ] Evals — add ask-cases to tests/evals/ (must-answer vs must-refuse; no invented numbers)

### Acceptance
- "Can I afford a 5,000 birr phone this month?" returns a grounded yes/no with reasoning; guard blocks advice/invented figures
- New eval cases pass in CI

Touches: src/modules/ai/, src/modules/coach/coach.guard.ts (reuse), src/integrations/llm/, tests/evals/
EOF

cat > "$workdir/p3.md" <<'EOF'
**Goal:** ship consent, start learning responsibly, close the first Amharic gaps, and prove the payoff with the eval tools already built.

Makes ADR 002 capture + the eval harness safe to turn on.

### Tasks
- [ ] Consent & retention — per-user opt-in (Mini App toggle + backend consent flag); capture only when consented AND AI_TRAINING_CAPTURE=true
- [ ] Retention job — purge raw captures past the window; de-identify (names/phones, IOU person-names) for export
- [ ] First Amharic wins — close the known-gap cases in fallback-parser.ts + the LLM prompt; promote them in tests/evals/parse-cases.ts
- [ ] Measure the upgrade — run npm run eval:llm; capture the report; summarize LLM vs rule
- [ ] Admin visibility — surface capture counts + eval pass-rate in the admin dashboard

### Acceptance
- Capture happens only for opted-in users; a retention job removes rows past the window
- The natural Amharic balance phrasing moves from knownGap to active and passes
- An eval:llm report exists comparing rule vs LLM parser quality

Touches: src/modules/ai/, src/modules/users/ (consent), src/jobs/ (retention), tests/evals/, src/modules/admin/
EOF

titles=(
  "Phase 01 — The Coach speaks first (proactive nudges + /coach in Telegram)"
  "Phase 02 — Ask Birrly anything (grounded, guardrailed Q&A)"
  "Phase 03 — Switch on the flywheel (consent, first Amharic wins, measure)"
)
files=("$workdir/p1.md" "$workdir/p2.md" "$workdir/p3.md")

if [[ "$APPLY" == "1" ]]; then
  # Ensure the label exists (no-op if it already does).
  gh label create roadmap --repo "$REPO" --color 1F9D6B --description "Next-quarter roadmap" 2>/dev/null || true
fi

for i in 0 1 2; do
  if [[ "$APPLY" == "1" ]]; then
    gh issue create --repo "$REPO" --title "${titles[$i]}" --label "roadmap" --body-file "${files[$i]}"
  else
    echo "would create: ${titles[$i]}"
  fi
done

echo ""
if [[ "$APPLY" == "1" ]]; then
  echo "Done — 3 issues created on $REPO."
else
  echo "Dry run. Re-run with APPLY=1 to create the issues:  APPLY=1 bash scripts/create-roadmap-issues.sh"
fi
