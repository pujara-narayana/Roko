---
name: qa-patterns-bounty
description: Recurring bug patterns and QA learnings from the Bounty marketplace review
metadata:
  type: feedback
---

## Patterns observed in Bounty codebase

**Empty-array reduce crash on all-fail pipeline path.**
`runCompetition` filters out non-submitted submissions before passing to oracle. Oracle's `results.reduce` on `[]` without an initial accumulator throws. Always pass all submissions (including timed_out/failed) to the oracle — the oracle already handles non-submitted status via early return. Guard: check `results.length === 0` before reduce.

**Why:** The seeded happy path always produces at least one PASS, so the empty path is never hit in smoke tests. The filter was added defensively but breaks the no-pass edge.

**How to apply:** In any pipeline that filters submissions/results before aggregation, always verify the aggregation handles an empty array. Check for `.reduce()` without initial value on potentially-empty arrays.

---

**SSE heartbeat emits on wrong stage.**
`startHeartbeat('verify')` in `pipeline.ts` emits `stage: 'compete'` regardless of argument. Heartbeat during verify stage temporarily reactivates the compete pip in the SSE reducer. Always emit heartbeat events on the current active stage, not a hardcoded one.

**How to apply:** When reviewing SSE emitters with heartbeat timers, verify the stage field matches the running stage dynamically.

---

**Settlement return event missing `amountUsd`.**
The `settle/released` event includes `amountUsd` but the `settle/returned` event does not. The UI can't display how much was returned to the poster. Always include symmetric payload fields in paired events (release/return, success/failure).

---

**Dual field naming: SSE payload vs REST response.**
`GET /api/leaderboard` returns `reputationScore` but the `done/complete` SSE event payload uses `reputation`. These are consumed by different paths (REST for Leaderboard page, SSE for SettlementPanel) and are internally consistent, but the discrepancy confused the orchestrator's runtime probe. Flag dual naming in future reviews.

---

**`escrowStatus` internal vs display naming.**
Internal `EscrowStatus` type uses `held/released/returned`. PRD criterion used `FUNDED/RELEASED/RETURNED`. Display layer never maps `held` → `Funded`, so audience sees raw enum value. Always add a display-mapping pass for internal status enums shown in UI.
