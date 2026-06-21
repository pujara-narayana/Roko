# PRD Addendum — Oracle Real LLM-Judge

**Parent PRD:** `docs/feature-factory/bounty-marketplace/02-prd.md`
**Status:** Scope locked. Addendum only — do not re-scope the parent product.
**Enhancement:** Replace the stub `semanticScore` function in `lib/oracle/index.ts` (lines 84–86) with a genuine low-temperature Claude semantic judge for fuzzy criteria, while preserving verdict determinism and graceful degradation.

---

## 1. Goal & Success Metric

**Goal:** The oracle's `semanticScore` stub (a formula derived entirely from deterministic check percentages) is replaced by a real Claude call that reads the submission's actual records against the bounty's `criteria[].semantic` descriptions, returning a richer fuzzy assessment and human-readable reason text. The pass/fail verdict and every gated quantity remain under deterministic authority only — the judge enriches explanation, not outcome.

**Success metric:** After this change, `OracleResult.reasons` for a data-research submission includes at least one entry whose `criterionId === 'semantic'` and whose `detail` text is demonstrably produced by Claude (non-formulaic, evaluative language about the actual records), and the verdict for Agent C is `pass` and Agent B is `fail` on three consecutive identical runs.

---

## 2. In Scope

- Replace the `semanticScore` stub in `lib/oracle/index.ts` with an async call to `anthropic.complete(...)` via the existing `lib/providers/anthropic.ts` wrapper.
- The judge evaluates the submission's records against `AcceptanceCriterion[].semantic` text fields from `AcceptanceRequirements.criteria`.
- The judge output is used to set a **non-gated** display field (call it `semanticInsight` or a dedicated `OracleReason` entry with `criterionId: 'semantic'`) and to enrich the human-readable reason text in `reasons`.
- `scoreSubmission` in `lib/oracle/index.ts` becomes `async` to await the judge call.
- `runOracle` already uses `Promise.resolve(scoreSubmission(...))` — it must be updated to `await scoreSubmission(...)` after the function is made async.
- Graceful degradation: when `ANTHROPIC_API_KEY` is absent or the call errors/times out, the oracle falls back to the prior deterministic semantic formula for the display value and emits a reason entry indicating the judge was unavailable. No exception propagates to callers.
- Optional in-memory cache keyed by a hash of the submission content (records array), to avoid redundant Claude calls across repeated rehearsal runs. Cache must be read-through only — it never alters any gated quantity.
- The `criteriaMatch` gate computation is restructured so it is **exclusively** a function of `criteriaMatchPct` (the deterministic predicate count). The `semanticPct` blend (`criteriaMatchPct * 0.7 + semanticPct * 0.3`) is removed from `criteriaMatch`. The judge score may feed a separate, non-gated `semanticQuality` display value.

## 3. Explicitly Out of Scope

| Deferred item | Rationale / when to revisit |
|---|---|
| Changing `OracleResult` or `OracleSubScores` shape | Frontend and QA are built against the existing type contract. Shape changes require a coordinated frontend pass — defer. |
| Adding a new named field to `OracleSubScores` for the semantic score | Same reason. Surface semantic score as an `OracleReason` entry, not a typed sub-score field, until the type is revisited. |
| Judge calling Claude for the deliverable path (`lib/oracle/judge.ts`) | `judgeDeliverable` already enriches `summary` via Claude. No change needed there. |
| Structured JSON output from the judge (multi-field parse) | Single natural-language sentence is sufficient for the demo. JSON response parsing adds failure surface with no demo payoff. |
| Caching across process restarts (Redis/disk) | In-memory Map is sufficient for rehearsal runs. Redis persistence is a post-demo optimization. |
| Per-record semantic evaluation | The judge evaluates the corpus as a whole against fuzzy criteria text. Per-record Claude calls would exceed latency budget. |
| Changing the PASS gate thresholds | Gate values (`completeness >= 95`, `criteriaMatch >= 90`, `validity >= 90`, `overall >= 90`, `duplicates == 0`) are fixed and must not change. |
| Seeded/hard-coded verdicts for hero bounty agents | Verdicts must remain an emergent output of the deterministic gate, not a special-cased value. |

---

## 4. User Stories

- As a **judge/viewer**, I want the oracle's semantic reason to contain evaluative language about the actual submission records (e.g., "All 20 companies are recognizable US fintechs with credible revenue indicators") rather than a formula printout, so that the oracle reads as intelligent verification, not arithmetic.
- As a **demo operator**, I want Agent C to always receive `verdict: 'pass'` and Agent B to always receive `verdict: 'fail'` regardless of what Claude returns for the semantic sub-score, so that a variable LLM response cannot break the demo on stage.
- As a **demo operator**, I want the oracle to complete successfully when `ANTHROPIC_API_KEY` is absent (e.g., a clean CI environment), so that the test suite does not require a live API key to pass.
- As a **developer**, I want the semantic judge call to time out within a fixed budget (≤ 12 seconds) and fall back cleanly, so that a slow Claude response cannot push the 4-minute hero loop over its wall-clock ceiling.

---

## 5. Features — Prioritized

| Priority | Feature | Description |
|---|---|---|
| P0 | Remove semantic blend from `criteriaMatch` gate | `criteriaMatch` must equal `Math.round(criteriaMatchPct)` only. The `semanticPct * 0.3` blend is removed. This is a pre-condition for verdict independence. |
| P0 | Real Claude semantic judge call | `scoreSubmission` calls `anthropic.complete(...)` with submission records and `criteria[].semantic` text; result populates a `reasons` entry with `criterionId: 'semantic'`. |
| P0 | Graceful degradation path | If `anthropic.isConfigured()` returns false, or the call returns `null`, the oracle continues with the prior formula value for display and logs a warning. No exception thrown. |
| P0 | `scoreSubmission` made async | Required to await the judge call. `runOracle` updated to `await scoreSubmission(...)`. |
| P1 | In-memory submission-content cache | Keyed by deterministic hash of `records` array (e.g., SHA-256 of JSON). Prevents redundant Claude calls on repeated rehearsal runs of the same submission. Cache is a read-through optimization; the returned value is never used to compute any gated quantity. |
| P1 | Judge timeout budget | Judge call uses `timeoutMs: 12_000` (12 seconds). On timeout, fall back to deterministic semantic formula. |
| P2 | Structured prompt with `criteria[].semantic` fields | Prompt enumerates the human-readable `semantic` descriptions from `AcceptanceCriterion[]` so the judge evaluates against actual bounty-specific fuzzy criteria, not generic heuristics. |

---

## 6. Acceptance Criteria (Machine-Checkable)

All criteria apply to the data-research oracle path (`taskType === 'data-research'`, `scoreSubmission` function in `lib/oracle/index.ts`). The deliverable judge path (`lib/oracle/judge.ts`) is unchanged and not tested here.

### 6a. Verdict Independence from the Judge

- [ ] **AC-VI-1 (gate isolation):** The value of `OracleResult.subScores.criteriaMatch` for any submission must equal `Math.round(criteriaMatchPct)` where `criteriaMatchPct = (criteriaMatched / requirements.targetCount) * 100`, and `criteriaMatched` is the count of records passing the deterministic predicate checks (sector, geo, revenue). No judge output may appear in this computation. Verify by inspecting the arithmetic path in `lib/oracle/index.ts` — no `semanticPct` variable or judge return value should appear in the expression assigned to `criteriaMatch`.

- [ ] **AC-VI-2 (degenerate judge cannot flip pass):** When the judge returns `null` (simulated by running with `ANTHROPIC_API_KEY` unset or mocked to return null), Agent C's submission (seeded 20/20 matching records, 0 duplicates, all valid emails) must still receive `verdict: 'pass'` with `criteriaMatch >= 90`, `completeness >= 95`, `validity >= 90`, `overall >= 90`, and `duplicates === 0`.

- [ ] **AC-VI-3 (degenerate judge cannot flip fail):** When the judge returns `null`, Agent B's submission (seeded 14/20 matching records, duplicates present) must still receive `verdict: 'fail'` with `criteriaMatch < 90`.

- [ ] **AC-VI-4 (no judge field in any gate expression):** A code-level assertion: the expressions computing `completeness`, `criteriaMatch`, `validity`, `overallScore`, and `duplicates` in `scoreSubmission` must not reference any variable holding the judge's return value. QA confirms by reading the post-implementation source; the engineer confirms by annotation in the PR.

- [ ] **AC-VI-5 (non-gated judge output only):** The judge's output (if any) appears only in: (a) an `OracleReason` entry with `criterionId: 'semantic'` in the `reasons` array, and/or (b) a non-gated display field. It must not appear in `subScores.criteriaMatch`, `subScores.completeness`, `subScores.validity`, `overallScore`, or `duplicates` on the returned `OracleResult`.

### 6b. Graceful No-Key Fallback

- [ ] **AC-GD-1 (no crash without key):** Running `scoreSubmission` for any valid submission when `ANTHROPIC_API_KEY` is absent (or the `anthropic.isConfigured()` check returns false) completes without throwing and returns a well-formed `OracleResult` with all required fields populated.

- [ ] **AC-GD-2 (no crash on timeout):** Running `scoreSubmission` when the Claude call is mocked to time out (e.g., abort after 1 ms) completes without throwing and returns a well-formed `OracleResult`.

- [ ] **AC-GD-3 (no crash on API error):** Running `scoreSubmission` when `anthropic.complete` returns `null` (simulating a non-200 response or network error) completes without throwing and returns a well-formed `OracleResult`.

- [ ] **AC-GD-4 (fallback reason text):** In the no-key / error / timeout fallback path, the `reasons` array still contains a `criterionId: 'semantic'` entry. Its `detail` field must not be empty; it should indicate the judge was unavailable (e.g., "Semantic judge unavailable — scored from deterministic signals").

- [ ] **AC-GD-5 (hero loop completes without key):** The full hero loop (`POST /api/bounty` through settlement) completes end-to-end with `ANTHROPIC_API_KEY` absent, Browserbase absent, and Redis absent — same as the existing reliability requirement. This criterion verifies the judge's graceful-degradation does not break the existing no-key path.

### 6c. Determinism of the Deterministic Gate

- [ ] **AC-DT-1 (three-run stability, with key):** Given the same seeded Agent C submission run three consecutive times with `ANTHROPIC_API_KEY` present, all three `OracleResult` objects must have: identical `verdict` (`pass`), identical `subScores.criteriaMatch`, `subScores.completeness`, `subScores.validity`, identical `duplicates`, and identical `gateResults[].passed` booleans. The `reasons[].detail` text for the `semantic` entry may vary between runs; this is acceptable since it is non-gating.

- [ ] **AC-DT-2 (three-run stability, without key):** Same as AC-DT-1 but with `ANTHROPIC_API_KEY` absent. All gated fields must be identical across three runs, and the `semantic` reason must reflect the deterministic fallback formula consistently.

- [ ] **AC-DT-3 (Agent B verdict stable):** Given the same seeded Agent B submission run three consecutive times (with or without `ANTHROPIC_API_KEY`), all three results must have `verdict: 'fail'` and `criteriaMatch < 90`.

### 6d. Real Judge Invocation (When Key Present)

- [ ] **AC-RJ-1 (judge called when key present):** When `ANTHROPIC_API_KEY` is configured and valid, `scoreSubmission` must attempt a call to `anthropic.complete` for data-research submissions with non-empty records. Verify by: (a) mocking `anthropic.complete` in a unit test and asserting it was called at least once during `scoreSubmission` execution, or (b) checking that `console.error('[anthropic]')` is NOT emitted (which would indicate a silent failure masking a non-call).

- [ ] **AC-RJ-2 (judge output appears in reasons):** When `ANTHROPIC_API_KEY` is present and the Claude call returns a non-empty string, the `OracleResult.reasons` array must contain at least one entry where `criterionId === 'semantic'` and `detail` matches the Claude-returned text (possibly trimmed/truncated but not replaced by the fallback formula).

- [ ] **AC-RJ-3 (non-formulaic reason text):** The `detail` field of the `semantic` reason entry, when the real judge is invoked, must not be the string `"Semantic quality score: N/100 (verified current employment, public presence)"` verbatim — that is the stub string from the prior implementation. Any distinct, evaluative text from Claude satisfies this criterion.

- [ ] **AC-RJ-4 (judge temperature constraint):** The `anthropic.complete` call for the semantic judge must pass `temperature` of `0.2` or lower (matching the constraint in `lib/oracle/judge.ts`'s `enrich` function). Verify by reading the call site in the post-implementation source.

- [ ] **AC-RJ-5 (judge timeout budget):** The `anthropic.complete` call for the semantic judge must pass `timeoutMs` of `12_000` (12 seconds) or less. Verify by reading the call site.

### 6e. Cache Behavior (If Implemented)

- [ ] **AC-CA-1 (cache is read-through only):** A second `scoreSubmission` call with identical records (same hash) must return identical `verdict`, `subScores`, `overallScore`, `duplicates`, and `gateResults` to the first call, whether the result was served from cache or computed fresh. The cache must not short-circuit the deterministic checks — it may cache the judge's text output only.

- [ ] **AC-CA-2 (cache miss is transparent):** A `scoreSubmission` call for a submission that has not been seen before (cache miss) must behave identically to a world where no cache exists.

- [ ] **AC-CA-3 (cache does not survive process restart — acceptable):** The in-memory cache is not required to persist across process restarts. This is documented behavior, not a defect.

---

## 7. Dependencies, Assumptions & Risks

| Item | Type | Detail |
|---|---|---|
| `lib/providers/anthropic.ts` `complete()` already returns `null` on all failure modes | **Assumption** | Confirmed by reading the implementation: the function catches all errors and returns `null`. The judge implementation may call it directly without its own try/catch, provided it treats `null` as the fallback trigger. |
| `scoreSubmission` signature change (sync → async) | **Dependency** | All callers of `scoreSubmission` must be updated. Currently the only direct caller is `runOracle` in the same file, which wraps it in `Promise.resolve(...)`. After the change, replace with `await scoreSubmission(...)`. Verify no other direct imports exist. |
| `OracleResult` and `OracleSubScores` type shapes are frozen | **Assumption** | No new typed fields are added. Semantic output surfaces via the existing `OracleReason[]` array (`criterionId: 'semantic'`). If a new typed field is needed, it requires a coordinated frontend change — defer to post-demo. |
| Judge adds ≤ 12 seconds to oracle latency in the unhappy path (timeout) | **Risk** | The hero loop has a 240-second wall-clock ceiling. The judge timeout budget (12 s) leaves adequate headroom. Mitigation: `timeoutMs: 12_000` is enforced at the call site; the fallback runs synchronously. |
| Judge adds ≤ 2–4 seconds to oracle latency in the happy path | **Assumption** | Based on observed `anthropic.complete` latency with `claude-haiku-4-5-20251001` at low token counts (prompt ≈ 300 tokens, response ≈ 40 tokens). QA must time the oracle phase during three rehearsal runs and confirm the hero loop still completes within 240 seconds. |
| `criteriaMatchPct * 0.7 + semanticPct * 0.3` blend is the only place judge output feeds a gate | **Assumption — must verify** | This is the implementation constraint from the run plan. Before shipping, the engineer must confirm no other expression in `scoreSubmission` references a semantic or judge-derived value. The PR must call this out explicitly. |
| Riskiest assumption (shifted from prior PRD) | **Validation needed** | The prior PRD's riskiest assumption was verdict stability across runs (variable LLM). With the deterministic gate binding, that risk is resolved by construction. The new riskiest assumption is: **the `criteriaMatch` blend removal does not accidentally move the gate value enough to change Agent C's verdict**. Verify: `criteriaMatchPct` for Agent C's seeded 20/20 submission is `100`; `Math.round(100) = 100 >= 90` — gate still passes. Confirm in the first rehearsal run. |
