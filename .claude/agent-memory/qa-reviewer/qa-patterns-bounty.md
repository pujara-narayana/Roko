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

---

**Oracle: `criteriaMatch` sub-score can exceed 100 on over-submissions.**
`criteriaMatchPct = (criteriaMatched / targetCount) * 100` is not capped. `completenessRaw` correctly uses `Math.min(records.length, targetCount)` but the criteria count does not. For seeded demo (always exactly 20 records) this is harmless. Flag this pattern in any oracle/scoring function that uses a fixed denominator.

**How to apply:** Whenever reviewing scoring functions, check whether every sub-score has an explicit `Math.min(100, ...)` cap. A capped completeness alongside an uncapped criteriaMatch is a red flag.

---

**Oracle: semantic `ok` field misleading on non-gating reason entries.**
When a Claude judge returns text, the code sets `ok: true` hardcoded regardless of sentiment. When the deterministic fallback fires, `ok: fallbackDisplay >= 90` can be `true` even on submissions that fail other gates. For non-gating reason entries (`criterionId: 'semantic'`), `ok` has no impact on verdict but can confuse readers of the `reasons` array. Pattern: verify that `ok` field on non-gating reason entries is either omitted or clearly non-authoritative.

---

**Oracle: reason `detail` text claims deduplication it does not perform.**
The criteria reason detail says "duplicates excluded from unique criteria count" but the criteria match loop iterates ALL records including duplicates. The verdict was still correct because `criteriaMatch` was < 90 even with duplicates counted. Pattern: when reviewing reason/explanation text, verify the description matches the actual code path — misleading fallback text can surface in user-visible UI.

---

**Structural vs. conventional verdict isolation: how to verify.**
The LLM-judge oracle change achieves structural isolation by: (1) storing judge output in a single local variable (`judgeText`), (2) using it in exactly one place (a `reasons.push()`), and (3) computing all gate values before the `await` call so no gate arithmetic can reference the variable. To verify structural isolation, grep the variable name and confirm every reference is non-arithmetic. If a variable appears in an `*` or `+` expression feeding a gate, it is conventional isolation (fragile), not structural.
