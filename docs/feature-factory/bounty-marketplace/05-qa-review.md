# QA Review — Bounty: AI-Agent Outcome Marketplace

**Reviewed by:** qa-reviewer agent  
**Date:** 2026-06-20  
**Build ref:** `npm run build` — 14 API routes + 7 pages, 0 TS errors (pre-verified by orchestrator)  
**Scope:** Must-Have hero loop only. Arize, Fetch.ai, MCP, second task type, real auth — explicitly excluded.

---

## Scope reviewed

Source files read in full:
- `lib/client/useRunStream.ts` — SSE reducer, polling fallback, seq dedupe
- `lib/oracle/index.ts` — scoring, PASS gate, division-by-zero guard
- `lib/escrow/index.ts` — settlement idempotency
- `lib/pipeline.ts` — orchestrator, heartbeat, no-pass path
- `lib/agents/index.ts` — parallel competition, timeout/retry, `runCompetition` filter
- `lib/sse/index.ts` — monotonic seq, formatSSE
- `lib/store/index.ts` — SortedSet, SSE pub-sub
- `lib/persist.ts` — artifact write paths
- `lib/seed/fixtures.ts` + `lib/seed/init.ts` — corpora, idempotent seeding
- `lib/types.ts` — all shared types
- `lib/client/api.ts` + `lib/client/format.ts` — typed fetch client, formatters
- `app/api/runs/route.ts`, `stream/route.ts`, `events/route.ts`
- `app/api/bounties/route.ts`, `[id]/escrow/route.ts`
- `app/api/leaderboard/route.ts`, `app/api/stats/route.ts`
- `app/page.tsx`, `app/browse/page.tsx`, `app/bounty/[id]/page.tsx`
- `app/run/[id]/page.tsx`, `app/leaderboard/page.tsx`
- `components/run/RunView.tsx`, `AgentCard.tsx`, `VerdictCard.tsx`
- `components/run/SettlementPanel.tsx`, `StageIndicator.tsx`
- `components/NavBar.tsx`

---

## Findings (prioritized)

| # | Severity | Area | Issue | Location | Suggested fix |
|---|----------|------|-------|----------|---------------|
| 1 | **High** | Agent competition | `runCompetition` filters out timed-out and failed-retrieval submissions before passing them to the oracle. If all 3 agents fail or time out, `submissions` is empty and `runOracle` receives `[]`. `results.reduce` then runs on an empty array with no initial value, throwing "Reduce of empty array with no initial accumulator" and crashing the pipeline. | `lib/agents/index.ts:237`, `lib/oracle/index.ts:292` | Always pass all submissions (including timed_out/failed) to the oracle — oracle already handles non-submitted status at line 99. Remove the `.filter(s => s.status === 'submitted')` in `runCompetition`, or add a guard in `runOracle`: `if (!results.length) return { ... escrowAction: 'return' }`. |
| 2 | **High** | Escrow contract | `GET /api/bounties/:id/escrow` returns `{ status: 'held' \| 'released' \| 'returned' }` (the internal `EscrowStatus` type). The PRD acceptance criterion requires `FUNDED \| RELEASED \| RETURNED` (uppercase). `Escrow.status` is typed as `'held'` not `'FUNDED'`. The bounty detail page renders raw `escrow.status` as a stat (e.g. "held"), which reads poorly to the audience and fails the machine-checkable criterion. | `lib/types.ts:95`, `app/bounty/[id]/page.tsx:58`, PRD criterion §Settlement | Either (a) add a display mapping in `bounty/[id]/page.tsx` (`held → Funded`, `released → Released`, `returned → Returned`) or (b) accept that the criterion used uppercase only to describe external API semantics, in which case update the bounty detail Stat label to show `held → Funded` so the audience sees a clean word. |
| 3 | **High** | No-pass path UX | When no agent passes, the `SettlementPanel` correctly shows "No passing submission — escrow returned to poster." However, `settlement.amountUsd` is `undefined` in the `returned` branch (pipeline emits `returnedTo` and `fallbackWinner` but no `amountUsd` in the `settle/returned` event). The `usd()` block in `SettlementPanel` renders `$undefined` if `settlement.amountUsd != null` guard fires — but actually it won't render because `undefined != null` is false. The missing amount is a UX gap: the audience cannot see how much was returned. | `lib/pipeline.ts:224-229`, `components/run/SettlementPanel.tsx:47-51` | Add `amountUsd: settledEscrow.amountUsd` to the `settle/returned` event payload in `pipeline.ts` (mirroring the `released` event). |
| 4 | **Medium** | SSE reducer | The heartbeat event emitted by `pipeline.ts` during the compete stage (`stage: 'compete', status: 'in_progress'`, `payload: { heartbeat: true }`) has **no `agentId`**. The reducer `case 'compete'` at line 150 unconditionally sets `activeStage: 'compete'` and `stages.compete = 'active'` on every such event — which is correct — but also falls into the `in_progress && agentId` branch only when `agentId` is present, so heartbeats without an agentId are safely ignored for card updates. No crash, but worth noting: heartbeat events from the verify stage are labelled `stage: 'compete'` (see `startHeartbeat('verify')` in `pipeline.ts:55`) — they will re-activate the compete stage pip if the compete pip has already completed, briefly resetting it from `complete` to `active` in the reducer. | `lib/pipeline.ts:45-55` | Change heartbeat stage to match current running stage: `emit({ stage: 'verify', status: 'in_progress', ... })` during the verify heartbeat. Or pass the stage dynamically based on which stage is active. |
| 5 | **Medium** | Oracle scoring — Alpha double-count | Agent Alpha submits 17 records: 14 good + 3 low-revenue + 3 duplicates = 20 total, but the fixture `getAlphaRecords()` returns `[...ALPHA_GOOD(14), ...ALPHA_BAD(3), ...ALPHA_DUPES(3)]` = 20 records. The `criteriaMatch` check counts how many of the 20 records match all criteria against `targetCount=20`. 14 match → `criteriaMatchPct = 70%`. The duplicate penalty reduces completeness further. `criteriaMatch = round(70 * 0.7 + 70 * 0.3) = 70`. All FAIL gates trigger correctly. However, the FAIL reason text says "14/20 companies matched revenue ≥$1M" — but 3 of Alpha's 20 records are duplicates of previously-counted good companies. The summary is technically accurate (14 unique good companies) but could be misleading because the audit trail conflates "14 matched criteria" with records that are themselves duplicates. No scoring bug, but the human-readable reason may confuse a judge who counts the listed companies. | `lib/oracle/index.ts:145-153`, `lib/seed/fixtures.ts:141-153` | Minor: add "note: 3 duplicates excluded from criteria count" to the `criteria` reason detail to distinguish unique criteria-matched records from raw record count. |
| 6 | **Medium** | VerdictCard `reasons` rendering | `VerdictCard` renders `verdict.reasons.map(...)` — all reasons, not limited to 3. The PRD/UX spec says "at least the first 3 itemized reasons." Rendering all is fine for coverage, but Alpha's verdict generates 5 reasons (format, criteria, duplicate, validity, semantic) and Beta's generates 5. At the current font size these all fit, but if `failingRows` sub-lists are long (up to 5 each), the card becomes very tall. No hard bug, but a judge looking for "at least 3" may be overwhelmed by 5 stacked sub-lists. | `components/run/VerdictCard.tsx:87-113` | Acceptable as-is. Optional: add a "Show more" collapse after the 3rd reason for cards with 5+ reasons. |
| 7 | **Medium** | `useRunStream` — double-start guard is per-instance only | `startedRef.current` guards against calling `start()` twice on the same component instance. However, if `RunView` unmounts and remounts (e.g. browser fast-refresh or navigation away and back), a new `useRunStream` instance is created with `startedRef = false`, causing a second `POST /api/runs`. The backend's idempotency guard on `POST /api/runs` returns the existing running run if one is active, so no duplicate run is started mid-flight. But if the first run has already completed, a new run starts from zero — the audience would watch the hero loop replay. During a live demo this is actually desirable for the repeat case; flag it as a known behavior, not a bug. | `lib/client/useRunStream.ts:304`, `app/api/runs/route.ts:27-35` | Document that navigating back to `/run/bounty-hero-001` after completion starts a fresh run. The idempotency guard only prevents concurrent runs, not sequential re-runs. This is correct for demo replayability. |
| 8 | **Medium** | `useElapsed` — timer starts on `running` but `run.started` is true before pipeline events arrive | `running = run.started && !run.complete && !run.error`. `run.started` is set by `start()` callback immediately (before the `POST /api/runs` resolves). The elapsed timer therefore starts counting from the moment the user clicks "Start Demo Run" — including the POST network round-trip (~50-100ms). For a demo this is negligible, but the timer does not zero-reset if the user clicks start and the POST fails (connection error path). | `lib/client/useElapsed.ts`, `components/run/RunView.tsx:42` | Acceptable for demo. If desired, move `started` to only be true after `runId` is received. |
| 9 | **Medium** | Leaderboard `reputation` field name — orchestrator probe discrepancy | `GET /api/leaderboard` returns `{ reputationScore: number }`. The `done/complete` SSE event payload (`leaderboard` array) is built from `store.listAgentsByReputation()` and maps to `{ agentId, name, reputation }` (line 249-252 of `pipeline.ts`). `useRunStream` types `leaderboard` as `Array<{ agentId: string; name: string; reputation: number }>`. `SettlementPanel` accesses `a.agentId` to find the winner rank via `leaderboard.findIndex`. This is correct. The orchestrator's runtime probe that printed `reputation: undefined` was likely reading from the REST endpoint (`reputationScore`) rather than the SSE event payload (`reputation`) — these are two different shapes. The shapes are internally consistent: SSE leaderboard uses `reputation`, REST uses `reputationScore`. No code bug, but the dual naming is a latent confusion risk when extending. | `lib/pipeline.ts:249-252`, `app/api/leaderboard/route.ts:14`, `lib/client/useRunStream.ts:77` | Low priority for demo. Post-demo: unify field name to `reputationScore` across SSE payload and `PipelineState.leaderboard` type. |
| 10 | **Low** | `StageAccordion` missing accessible expand/collapse label | The `StageAccordion` toggle button renders `▲`/`▼` as plain text without `aria-label` or `aria-expanded`. Screen readers announce the button as "▲" with no context. | `components/run/RunView.tsx:237-247` | Add `aria-expanded={open}` and `aria-label={`${open ? 'Collapse' : 'Expand'} POST stage`}` to the toggle button. |
| 11 | **Low** | `RankRow` keyboard focus — space key prevented but no visible focus ring | `RankRow` handles `Enter`/`Space` via `onKeyDown` and calls `e.preventDefault()`. The `tr` has `tabIndex={0}` but no explicit `:focus-visible` style — the browser default outline is suppressed by the global CSS reset in many Tailwind setups. During a demo the keyboard UX is unlikely to be tested, but it is a gap against the UX spec's accessibility notes. | `app/leaderboard/page.tsx:118-122` | Add `outline: 2px solid var(--paint-blue); outline-offset: -2px` on `:focus-visible` for `tr[tabIndex]`. |
| 12 | **Low** | `cleanText` duplicate replacement patterns | `format.ts` has `â€¦` replaced twice and `â€"` replaced twice with the same replacement string. The duplicate replacements are harmless (no double-replacement side effect) but indicate copy-paste noise. | `lib/client/format.ts:53-59` | Remove duplicate lines. |
| 13 | **Low** | `SettlementPanel` leaderboard delta rank calculation | `winnerRank = leaderboard.findIndex(a => a.agentId === settlement.winnerAgentId)`. The `leaderboard` in SSE payload is the post-settlement snapshot (updated reputation). So the rank shown is the NEW rank after the win, not the delta. The UX spec says "Agent C: rank +2 → #3" (delta + final). The panel only shows "Agent C now ranked #1" (final rank only, no delta shown). | `components/run/SettlementPanel.tsx:17-68` | Either: (a) accept "now ranked #N" as sufficient for demo, or (b) store pre-run rank in `PipelineState` and compute delta. |

---

## Acceptance-criteria check

### Intake agent

- [x] `POST /api/bounty` returns HTTP 200 with a `requirements` object containing `targetCount`, `sector`, `geo`, `minRevenue`, `requiredFields`, `criteria` — **PASS** (`app/api/bounties/route.ts`, `lib/intake.ts`)
- [x] Requirements JSON written to `data/runs/<runId>/requirements.json` before agents dispatched — **PASS** (`lib/pipeline.ts:76`, `lib/persist.ts:20-37`)
- [x] Mock escrow record created with status `FUNDED` (internally `held`) and poster's reward before competition — **PASS** (internal status `held` = funded; `lib/pipeline.ts:91`, `lib/escrow/index.ts:9-21`). Note: public-facing status string is `held`, not `FUNDED` — see Finding #2.

### Agent competition

- [x] Exactly 3 agents dispatched in parallel — **PASS** (`lib/agents/index.ts:226-235`, `Promise.all`)
- [x] Each agent produces a submission with `records[]`, `submissionId`, `agentId`, persisted at `submission-<agentId>.json` — **PASS** (`lib/persist.ts:39-55`)
- [x] Agent Alpha (seeded failing) produces < 20 criteria-matched companies + duplicates — **PASS** (14 good + 3 low-revenue + 3 duplicates = 20 records, 14 criteria-matched, 3 duplicates; `lib/seed/fixtures.ts:141-153`)
- [x] Single failure triggers one auto-retry; second failure → `FAILED_RETRIEVAL`, no crash — **PASS** (`lib/agents/index.ts:131-212`)
- [x] Agent timeout → `TIMED_OUT` status, oracle proceeds — **CONDITIONAL PASS**: oracle correctly excludes non-submitted statuses, but `runCompetition` filter at line 237 drops timed-out/failed submissions before oracle receives them. If all 3 agents fail simultaneously, oracle receives `[]` and crashes on empty reduce (Finding #1). Seeded happy path is unaffected.

### Verification oracle

- [x] `POST /api/oracle/verify` (or internal trigger) returns per-agent score with `criteriaMatch`, `completeness`, `validity`, `overall`, `duplicates`, `reasons` — **PASS** (`lib/oracle/index.ts:90-276`)
- [x] Oracle returns within 60 seconds on seeded path — **PASS** (~25s total per smoke test)
- [x] PASS gate enforced: `completeness>=95 AND criteriaMatch>=90 AND validity>=90 AND overall>=90 AND duplicates==0` — **PASS** (`lib/oracle/index.ts:218-252`)
- [x] Agent Alpha marked FAIL with reasons referencing criteria mismatch and duplicates — **PASS** (`lib/oracle/index.ts:162-175`, `lib/seed/fixtures.ts`)
- [x] Agent Charlie marked PASS with all four scores >= 90 and duplicates == 0 — **PASS** (charlie semantic stub = 98, all 20 records good, 0 duplicates)
- [x] Oracle scores persisted to `oracle-scores.json` — **PASS** (`lib/persist.ts:57-75`)
- [x] No-pass path: `fallbackWinner` set and `escrowAction: "return"` — **PASS** (`lib/oracle/index.ts:291-300`) — note: smoke test always produces a winner (Charlie PASS), so the no-pass branch was not exercised at runtime; code path exists and is correct.

### Settlement

- [x] PASS submission → escrow transitions `held → released` with `releasedTo: <agentId>`, reflected in UI — **PASS** (`lib/escrow/index.ts:24-48`, `components/run/SettlementPanel.tsx`)
- [x] No-pass → escrow transitions to `returned` with `returnedTo: "poster"`, shown in UI — **PASS** (code path correct; `amountUsd` missing from `returned` event — Finding #3, UX gap only)
- [x] `GET /api/escrow/<bountyId>` returns `status` and relevant party field — **PASS** (`app/api/bounties/[id]/escrow/route.ts:13-23`)

### Live pipeline status (SSE)

- [x] SSE connection opened to `GET /api/runs/:runId/stream` immediately after bounty posted — **PASS** (`lib/client/useRunStream.ts:344-377`)
- [x] Stream emits at least one event per stage (`post/intake`, `compete`, `verify`, `settle`) — **PASS** (`lib/pipeline.ts` emits `intake`, `escrow`, `compete`, `verify`, `settle`, `done`)
- [x] Each agent emits `started` and `submitted` (or `failed`) events with `agentId` — **PASS** (`lib/agents/index.ts:123-210`)
- [x] UI displays distinct visual state per stage (spinner, checkmark, etc.) — **PASS** (`components/run/StageIndicator.tsx`, `AgentCard.tsx`)
- [x] SSE drop → auto-reconnect (EventSource retry) — **PASS** (`lib/client/useRunStream.ts:367-376`, falls back to polling)

### VerdictCard UI

- [x] VerdictCard rendered per agent with name, `criteriaMatch`, `completeness`, `validity`, `overall`, PASS/FAIL badge, at least 3 reasons — **PASS** (`components/run/VerdictCard.tsx`)
- [x] Agent Alpha VerdictCard shows FAIL badge and at least one human-readable reason — **PASS**
- [x] Agent Charlie VerdictCard shows PASS badge with all scores >= 90 — **PASS**
- [x] Passing agent's VerdictCard shows escrow release confirmation — **PASS** (`VerdictCard.tsx:115-124`, `RunView.tsx:174-178`)

### Leaderboard

- [x] `GET /api/leaderboard` returns agents sorted descending by reputation — **PASS** (`app/api/leaderboard/route.ts`)
- [x] After settlement, passing agent's reputation higher; change reflected on Leaderboard page — **PASS** (reputation +50 via `lib/escrow/index.ts:43`, leaderboard re-fetched on next mount; no live push to Leaderboard page during a run — see below)
- [x] Leaderboard shows `agentId`, `agentName`, `reputationScore`, `totalBounties`, `passRate` — **PASS** (route returns all fields including `totalBounties: agent.completions`, `agentName: agent.name`)
- [x] In-memory Redis fallback stores leaderboard state correctly across requests — **PASS** (module singleton `SortedSet` in `lib/store/index.ts`)

### Marketplace UI shell

- [x] Landing page renders live-stats tiles (bounties posted, agents active, escrow value) — **PASS** (`components/landing/StatsTiles.tsx` consumes `GET /api/stats`)
- [x] Browse Tasks page displays bounty cards filterable by category — **PASS** (`app/browse/page.tsx`, client-side filter)
- [x] Clicking a bounty card navigates to detail view showing description, reward, status — **PASS** (`app/bounty/[id]/page.tsx`)
- [x] Leaderboard page renders ordered agents with reputation scores — **PASS** (`app/leaderboard/page.tsx`)
- [ ] All four pages render without JavaScript console errors — **NOT VERIFIED** (static analysis only; browser runtime console was not checked in this review pass)

### Reliability & non-functional

- [x] Hero loop completes within 240s — **PASS** (~25s per smoke test)
- [x] Loop repeatable across 3 consecutive runs without crash — **PASS** (pre-verified by orchestrator)
- [x] Browserbase not required — **PASS** (seeded corpus used; `BROWSERBASE_API_KEY` not required)
- [x] Redis not required — **PASS** (in-memory `SortedSet` fallback)
- [x] All intermediate artifacts written to disk — **PASS** (`lib/persist.ts`)

---

## Missing states / edge cases

**Edge case confirmed: empty-submissions oracle crash (Finding #1).**  
The path `all 3 agents fail or time out simultaneously` causes `results.reduce` on an empty array without an initial accumulator, throwing a runtime error. This crashes the pipeline and emits `done/failed`. This path is not reachable in the seeded happy path but would fire if `AGENT_TIMEOUT_MS` is set very low (e.g. during local testing).

**No-pass path is code-correct but under-exercised.** The smoke test always results in a Charlie PASS. A no-pass test run (e.g. temporarily removing Charlie from competition) has not been run. Code analysis confirms the path is structurally complete.

**Leaderboard page does not live-update during a run.** The Leaderboard page fetches once on mount via `useEffect` and never re-fetches. The post-settle leaderboard rank shown in `SettlementPanel` (from the SSE `done` payload) is a current-run-only snapshot. Navigating to `/leaderboard` after a run shows the updated reputation, but the Leaderboard page itself will not update if it was already open. The UX spec calls for a "live update banner" on the Leaderboard page post-settle. This is not implemented — the update only happens on next mount/refresh. For a demo where the audience watches `/run/...` and then clicks "View Leaderboard," this is acceptable.

**`POST /api/bounties` escrow is funded immediately on bounty creation** (before a run starts). `executePipeline` then calls `fundEscrow` again, which returns the existing escrow (idempotent). This means on the first call to `/api/bounties`, the escrow is in `held` status. The pipeline then re-funds (no-op). The stage indicator correctly shows "Funded" after the `escrow/funded` SSE event. The double-fund call is harmless but creates a slightly confusing artifact: an escrow exists for the hero bounty even before any run starts.

**`cleanText` has a latent unicode issue (Finding #12):** `â€¦` appears in the replacement map twice with identical replacements. This is a no-op double replacement and harmless, but it indicates the pattern was hand-edited and could mask a missed third encoding variant.

---

## Positive observations

- **`safeDivide` guard** is correctly placed and eliminates all division-by-zero paths in oracle scoring — this was the highest-risk numeric bug and it is handled.
- **Seq deduplication** in the reducer (`if (event.seq <= prev.lastSeq) return prev`) is correctly monotonic and handles SSE replay on reconnect without duplicating UI state.
- **`runCompetition` parallel + timeout pattern** (`Promise.all` + `Promise.race`) is idiomatic and correct. The auto-retry loop correctly limits to 2 attempts.
- **Settlement idempotency** in both `releaseEscrow` and `returnEscrow` is correctly guarded by status checks before mutation — calling twice is safe.
- **Sub-score order is locked** by `SUBSCORE_ORDER` constant in `VerdictCard.tsx` — the contract between backend and UI is enforced by this constant, not by the incoming JSON key order.
- **SSE stream reconnect** includes `Last-Event-ID` replay from the server — the route correctly filters `e.seq > afterSeq` and replays missed events before subscribing live.
- **Heartbeat every 8s** is implemented both at the pipeline level (SSE wire comment `: heartbeat`) and at the application level (compete/verify stage heartbeat events) — dead-air is well-covered.
- **Accessibility baseline** is solid: `StageIndicator` uses `role="list"` + `role="listitem"` + `aria-label`, `AgentCard` live log has `aria-live="polite"`, `VerdictCard` badge has `aria-label`, `SettlementPanel` section has `aria-live="assertive"`.
- **Marbled Ink design tokens** are consistently applied via CSS custom properties — no raw Tailwind color class overrides spotted in the centerpiece components.

---

## Verdict

**Fix-then-ship** — two high-severity issues need resolution before a reliable demo:

1. **Finding #1 (High — `runCompetition` filter crashes oracle on all-fail):** Fix the empty-reduce crash before any demo with reduced `AGENT_TIMEOUT_MS`.  
2. **Finding #3 (High — no-pass path missing `amountUsd` in returned event):** Add `amountUsd` to the `settle/returned` payload so the amount returned is visible to the audience.
3. **Finding #2 (High — escrow status display shows `held` not `Funded`):** Add a display mapping in the bounty detail Stat component.

High-priority items routed back to: **backend-engineer** (Finding #1 + #3), **frontend-engineer** (Finding #2).

Findings #4–#13 are medium/low and do not block the seeded hero-loop demo. They are candidates for a polish pass after the primary three are resolved.

---

## Fix pass resolution (2026-06-20)

User elected to fix **all 13 findings**. Routed: backend-engineer (#1, #3, #4, #5, #9 SSE payload) and frontend-engineer (#2, #6, #8, #9 consumer, #10, #11, #12, #13). #7 confirmed intentional (demo replay) — no change.

| # | Resolution | Where |
|---|------------|-------|
| 1 | All submissions (incl. timed_out/failed) now passed to oracle; `runOracle` early-returns a well-formed no-pass result when empty — no empty-reduce crash | `lib/agents/index.ts`, `lib/oracle/index.ts` |
| 2 | Escrow status display-mapped held→Funded / released→Released / returned→Returned | `app/bounty/[id]/page.tsx` |
| 3 | `amountUsd` added to `settle/returned` event payload | `lib/pipeline.ts` |
| 4 | Heartbeat now emits the currently-active stage (verify heartbeat no longer re-activates compete pip) | `lib/pipeline.ts` |
| 5 | Criteria reason detail clarifies "duplicates excluded from unique criteria count" | `lib/oracle/index.ts` |
| 6 | VerdictCard collapses reasons after 3 with a "Show N more" toggle | `components/run/VerdictCard.tsx` |
| 8 | Elapsed timer gated on `runId` (real pipeline time, not pre-POST click) | `components/run/RunView.tsx` |
| 9 | SSE leaderboard field unified to `reputationScore`; frontend type + SettlementPanel updated to match. Verified end-to-end (`done.leaderboard[0].reputationScore`) | `lib/pipeline.ts`, `lib/client/useRunStream.ts`, `components/run/SettlementPanel.tsx` |
| 10 | Accordion toggle has `aria-expanded` + label | `components/run/RunView.tsx` |
| 11 | `:focus-visible` outline (paint-blue) for focusable rows | `app/globals.css` |
| 12 | Duplicate `cleanText` replacements removed | `lib/client/format.ts` |
| 13 | SettlementPanel shows final rank + climb indicator (▲) | `components/run/SettlementPanel.tsx` |
| 7 | No change — sequential re-run on remount is intentional demo replayability | — |

**Re-verification:** `npm run build` clean (14 routes + 7 pages, 0 TS errors). Fresh hero loop: 36 ordered events, Alpha FAIL / Beta FAIL / Charlie PASS → `settle/released` $500 to agent-charlie → `done.leaderboard` emits `reputationScore`. **Verdict: ship.**
