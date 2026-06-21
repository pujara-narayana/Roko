---
name: qa-patterns-bounty
description: Recurring bug patterns and QA learnings from the Bounty marketplace review (store + Redis layer)
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

---

## Redis write-through mirror patterns (from redis-layer QA, 2026-06-21)

**Seed/hydration race corrupts Redis on restart.**
When a sync seed runs before async hydration completes, every `store.setAgent()` / `store.setBounty()` call in the seed fires mirror writes that overwrite Redis with seed defaults. Hydration then reads the corrupted data. Fix: never seed through the store's public setters during the hydration grace period; use direct Map mutations, or make seedStore async and await hydration.

**How to apply:** Whenever reviewing a write-through mirror + boot-time hydration pattern, verify that the seed path does NOT call the same store setters that trigger mirror writes. Hydration and seeding must be mutually exclusive.

---

**appendEvent / mutating sub-collections must also mirror.**
If a store method mutates a nested array (e.g., `run.events.push(event)`) instead of replacing the top-level object, the corresponding mirror call must fire in that mutation method too — not just in the parent `setRun`. Checking only the `setXxx` methods for mirror calls misses mutation-only paths.

**How to apply:** When auditing mirror call coverage, search for ALL methods that mutate entities, not just the ones that replace them outright.

---

**incrementReputation must mirror the full agent, not just the leaderboard score.**
The leaderboard sorted-set score and the agent hash can diverge if only one is mirrored after a reputation change. On hydration: sorted-set restores correct ranking, but agent objects hydrate from the hash — showing stale reputation values in the API.

**How to apply:** Verify that any partial mirror (e.g., a leaderboard score update) is accompanied by a full-object mirror if the object contains a denormalized copy of the same field.

---

**Dead Redis client after reconnect exhaustion still held in `_client`.**
When `reconnectStrategy` returns an Error to stop reconnecting, the client emits `'end'` but the module-level `_client` variable still holds the closed client object (not null). Subsequent `getRedis()` calls return the dead client; mirror commands throw and are swallowed by try/catch. Fix: set `_client = null` in the reconnect-limit branch or `'end'` event handler.

**How to apply:** When reviewing Redis singleton clients with reconnect limits, verify that the client reference is nulled out when the client permanently closes, so callers get a clean null instead of a dead object.
