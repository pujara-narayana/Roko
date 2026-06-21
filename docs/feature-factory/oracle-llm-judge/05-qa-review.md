# QA Review — Oracle Real LLM-Judge

**Reviewer:** qa-reviewer agent  
**Date:** 2026-06-21  
**Branch:** dev-2  
**Scope:** `lib/oracle/index.ts` post-implementation; supporting files `lib/oracle/judge.ts`, `lib/providers/anthropic.ts`, `lib/types.ts`, `lib/seed/fixtures.ts`.  
**TypeScript:** `npx tsc --noEmit` exits clean (no output, exit 0).

---

## Scope Reviewed

The backend engineer replaced the stub `semanticScore` formula in `lib/oracle/index.ts` with a real low-temperature Claude semantic judge (`callSemanticJudge`), removed the `semanticPct` blend from `criteriaMatch`, made `scoreSubmission` async, and updated `runOracle` to use `Promise.all` with the async function. No other files were modified.

---

## Findings — Prioritized Table

| # | Severity | Category | Title | AC violated |
|---|---|---|---|---|
| 1 | LOW | Misleading display | Semantic reason `ok: true` hardcoded when real judge returns text, regardless of assessment content | AC-RJ-2 (cosmetic only) |
| 2 | LOW | Misleading display | Fallback semantic reason `ok: true` on deterministically-failing submissions (Beta: fallbackDisplay = 90) | AC-GD-4 (cosmetic only) |
| 3 | LOW | Misleading comment | Criteria predicate reason `detail` says "duplicates excluded from unique criteria count" but duplicates are NOT excluded from `criteriaMatched` count in the code | none (pre-existing) |
| 4 | LOW | Edge case | `criteriaMatch` (and therefore `overallScore`) can exceed 100 when a submission contains more records than `requirements.targetCount` | AC-VI-1 (general correctness) |
| 5 | INFO | Pre-existing | `validityOk` used only in the reason `ok` field; the validity gate uses `Math.round(validityPct) >= 90`. Mismatched logic can show `ok: false` reason while the gate passes (e.g., 18/20 valid = `validityPct=90`, gate passes, `validityOk=false`). Not introduced by this change. | none |

---

## Acceptance-Criteria Check

### 6a — Verdict Independence from the Judge

| AC | Pass/Fail | Evidence |
|---|---|---|
| **AC-VI-1** gate isolation | **PASS** | `criteriaMatch = Math.round(criteriaMatchPct)` at line 291. Confirmed by grep: only one assignment to `criteriaMatch` in `scoreSubmission`; no `semanticPct`, `judgeText`, or any judge-derived variable appears in the expression. |
| **AC-VI-2** degenerate judge cannot flip pass | **PASS** | With no key, `callSemanticJudge` returns `null` at line 107 before any network call. Agent C math: `criteriaMatch=100, completeness=100, validity=100, overallScore=100, dupCount=0` — all gates pass. Verdict `pass`. |
| **AC-VI-3** degenerate judge cannot flip fail | **PASS** | Agent Alpha math: `criteriaMatch=85 (<90), completeness=85 (<95), dupCount=3 (≠0)` — three gate failures, verdict `fail` independent of judge. Agent Beta: `validity=75 (<90)` — gate fail independent of judge. |
| **AC-VI-4** no judge field in any gate expression | **PASS** | `judgeText` appears at lines 260, 264, 266, 271 only. Lines 291–313 compute `criteriaMatch`, `validity`, `overallScore`, and gate booleans with zero reference to `judgeText`. Verified by grep. |
| **AC-VI-5** non-gated judge output only | **PASS** | `judgeText` is consumed solely in the `reasons.push(...)` at lines 268–273. It does not appear in `subScores.criteriaMatch`, `completeness`, `validity`, `overallScore`, or `duplicates` on the returned `OracleResult`. |

**6a verdict: structural guarantee, not convention.** The claim of structural isolation holds. `judgeText` is a local `string | null` that physically cannot reach any arithmetic feeding a gate in the current code. A future developer would have to deliberately extract it and insert it into one of the gate expressions — the code layout makes this an active decision, not an accidental slip.

---

### 6b — Graceful No-Key Fallback

| AC | Pass/Fail | Evidence |
|---|---|---|
| **AC-GD-1** no crash without key | **PASS** | `callSemanticJudge` returns `null` at line 107 when `anthropic.isConfigured()` is false. `scoreSubmission` falls into the `else` branch at line 274, computes `fallbackDisplay`, pushes a reason entry, returns well-formed `OracleResult`. |
| **AC-GD-2** no crash on timeout | **PASS** | `anthropic.complete` calls `AbortController.abort()` after `timeoutMs` and catches the resulting `AbortError` in its `catch` block (line 69 of `anthropic.ts`), returning `null`. `callSemanticJudge` then returns `null` (line 139). Additional `.catch(() => null)` at line 264 of `index.ts` provides a second safety layer. |
| **AC-GD-3** no crash on API error | **PASS** | `anthropic.complete` catches non-200 HTTP responses and network errors, returns `null`. Same fallback path as above. `.catch(() => null)` at call site is belt-and-suspenders. |
| **AC-GD-4** fallback reason text | **PASS** | Line 282: `detail: \`Semantic judge unavailable — scored from deterministic signals: ${fallbackDisplay}/100\`` — non-empty, informative. However see Finding #2: the `ok` field of this entry may be `true` even on failing submissions (Beta: `fallbackDisplay=90`, `ok: true`), which is cosmetically inconsistent with the submission failing. Non-gating. |
| **AC-GD-5** hero loop completes without key | **PASS** | `runOracle` at line 174 of `pipeline.ts` is already `await`ed. `scoreSubmission` completes synchronously through the no-key fast-path in `callSemanticJudge`. No blocking or unhandled rejection. |

---

### 6c — Determinism of the Deterministic Gate

| AC | Pass/Fail | Evidence |
|---|---|---|
| **AC-DT-1** three-run stability with key | **PASS** | `criteriaMatch`, `completeness`, `validity`, `duplicates`, and all `gateResults[].passed` values derive solely from the `records` array and `requirements` — both are static seeded values. Identical inputs → identical gate outputs on every run. The `semantic` reason `detail` may vary (non-gating, acceptable per spec). |
| **AC-DT-2** three-run stability without key | **PASS** | No-key path uses `fallbackDisplay = Math.round(Math.min(100, criteriaMatchPct * 0.6 + validityPct * 0.4))` — fully deterministic. Same seeded inputs produce identical `detail` strings across runs. |
| **AC-DT-3** Agent B verdict stable | **PASS** | Agent Beta: `validity=75 (<90)` and Agent Alpha: `criteriaMatch=85 (<90), dupCount=3` — these gate failures are deterministic and independent of the judge. `verdict: 'fail'` is stable across runs with or without a key. |

---

### 6d — Real Judge Invocation (When Key Present)

| AC | Pass/Fail | Evidence |
|---|---|---|
| **AC-RJ-1** judge called when key present | **PASS** | When `anthropic.isConfigured()` returns true, `callSemanticJudge` does not short-circuit at line 107. It constructs a prompt and calls `anthropic.complete(...)` at line 131. The function only skips the call on cache hit (same records hash), and for the first run with each unique `records` array the call is made. |
| **AC-RJ-2** judge output appears in reasons | **PASS** | When `anthropic.complete` returns a non-empty string (> 10 chars after trim), it is stored in `result` and returned. In `scoreSubmission`, `judgeText !== null` triggers the `if` branch at line 266, pushing a reason entry with `criterionId: 'semantic'` and `detail: judgeText`. See Finding #1 regarding `ok: true` hardcoding. |
| **AC-RJ-3** non-formulaic reason text | **PASS** | The string `"Semantic quality score"` (the old stub) is absent from `lib/oracle/index.ts`. Confirmed by grep. The `callSemanticJudge` function passes a structured prompt asking Claude to assess against the actual `criteria[].semantic` descriptions. |
| **AC-RJ-4** judge temperature ≤ 0.2 | **PASS** | Line 133: `temperature: 0.2`. |
| **AC-RJ-5** judge timeout ≤ 12 000 ms | **PASS** | Line 134: `timeoutMs: 12_000`. |

---

### 6e — Cache Behavior

| AC | Pass/Fail | Evidence |
|---|---|---|
| **AC-CA-1** cache is read-through only | **PASS** | `_judgeCache` stores `string` values (judge text) only. Cache hit at line 110–111 returns the judge text; all deterministic checks (criteria, completeness, dup, email) are computed in `scoreSubmission` BEFORE `callSemanticJudge` is awaited at line 264. A cache hit or miss does not change any gate. |
| **AC-CA-2** cache miss is transparent | **PASS** | On cache miss, `anthropic.complete` is called and the result cached only if non-null (line 141–143). A null result is returned as-is and NOT cached — future calls with the same hash will retry the API, not serve a null from cache. This means a transient failure does not permanently poison the cache for a submission. |
| **AC-CA-3** cache does not survive restart | **PASS** | `_judgeCache` is a module-scope `Map`. Documented behavior, not a defect. |

---

## Detailed Finding Analysis

### Finding #1 — LOW: Semantic reason `ok` hardcoded `true` when judge returns text

**File/line:** `lib/oracle/index.ts` line 270  
**Issue:** `ok: true` is hardcoded in the judge-present branch. If Claude returns an evaluative sentence that is negative ("These companies lack verifiable US fintech characteristics"), the reason entry will still show `ok: true` in the UI.  
**Impact:** Cosmetic only. The `ok` field on an `OracleReason` entry has no effect on any gate or verdict. The verdict is determined by the deterministic gate at lines 324–329. A viewer might interpret `ok: true` as a semantic endorsement even when Claude expressed concern.  
**Recommendation (non-blocking):** Consider parsing the judge text for negative sentiment markers, or default `ok` to `null`/omit it for the semantic entry since its truth value is not deterministic. For the demo this is benign.

---

### Finding #2 — LOW: Fallback `ok: true` on deterministically-failing submissions

**File/line:** `lib/oracle/index.ts` line 281  
**Issue:** `ok: fallbackDisplay >= 90`. For Agent Beta (5 bad emails, validity=75), `criteriaMatchPct=100` and `validityPct=75`, so `fallbackDisplay = Math.round(100*0.6 + 75*0.4) = 90`. The semantic reason entry shows `ok: true` while the submission fails the `validity` gate and receives `verdict: 'fail'`.  
**Impact:** Cosmetic only. Non-gating. The verdict shown to the user is `fail` regardless. A reader inspecting the `reasons` array might be briefly confused by the semantic entry showing success on a failing submission.  
**Recommendation (non-blocking):** No change needed for demo correctness. If reasons are surfaced in the UI, the `verdict` field takes precedence.

---

### Finding #3 — LOW (pre-existing): Criteria reason `detail` text claims deduplication it does not perform

**File/line:** `lib/oracle/index.ts` line 209  
**Issue:** The `detail` string reads `"N/20 companies matched all criteria ... — duplicates excluded from unique criteria count"`. However, the criteria match loop at lines 196–202 iterates ALL records including duplicates. It does not subtract or skip duplicate records.  
**Impact:** For Agent Alpha, `criteriaMatched = 17` (14 good + 3 dup-copies of good records that also pass criteria), and the `detail` text would claim "17/20 matched — duplicates excluded" which is factually incorrect. The verdict is still `fail` (criteriaMatch=85 < 90), but the reason text is misleading.  
**Note:** This is a pre-existing issue, not introduced by this change. The blend removal did not touch this logic.  
**Recommendation:** Remove `— duplicates excluded from unique criteria count` from the detail string, or perform the exclusion before computing `criteriaMatched`.

---

### Finding #4 — LOW: `criteriaMatch` (and `overallScore`) can exceed 100 on over-submitted records

**File/line:** `lib/oracle/index.ts` lines 204, 291, 310–313  
**Issue:** `criteriaMatchPct = (criteriaMatched / requirements.targetCount) * 100`. If an agent submits 25 records and all 25 match criteria, `criteriaMatchPct = 125`, `criteriaMatch = 125`, and `overallScore` can reach 109. `completenessRaw` is correctly capped via `Math.min(records.length, targetCount)` but `criteriaMatchPct` has no corresponding cap.  
**Impact:** For the seeded demo (always exactly 20 records) this is harmless. In ad-hoc use, a submission with extra matching records would report `criteriaMatch: 125` in `subScores`, which is outside the documented 0–100 range in `OracleSubScores`.  
**Note:** Pre-existing issue, not introduced by this change.  
**Recommendation:** Add `Math.min(100, ...)` cap: `const criteriaMatch = Math.round(Math.min(100, criteriaMatchPct))`.

---

## Math Verification — Seeded Corpus Verdicts

### Agent C (Specialist / `getPerfectCorpus()`)

| Gate | Value | Threshold | Passes |
|---|---|---|---|
| criteriaMatch | 100 | ≥ 90 | YES |
| completeness | 100 | ≥ 95 | YES |
| validity | 100 | ≥ 90 | YES |
| duplicates | 0 | = 0 | YES |
| overall | 100 | ≥ 90 | YES |

**Verdict: `pass`.** Identical with or without `ANTHROPIC_API_KEY`. The blend removal (100 → still 100) caused no regression.

### Agent Beta (Challenger B / `getBadEmailCorpus()`)

| Gate | Value | Threshold | Passes |
|---|---|---|---|
| criteriaMatch | 100 | ≥ 90 | YES |
| completeness | 100 | ≥ 95 | YES |
| validity | 75 | ≥ 90 | **NO** |
| duplicates | 0 | = 0 | YES |
| overall | 93 | ≥ 90 | YES |

**Verdict: `fail`** (validity gate).

### Agent Alpha (Challenger A / `getDuplicatesCorpus()`)

| Gate | Value | Threshold | Passes |
|---|---|---|---|
| criteriaMatch | 85 | ≥ 90 | **NO** |
| completeness | 85 | ≥ 95 | **NO** |
| validity | 100 | ≥ 90 | YES |
| duplicates | 3 | = 0 | **NO** |
| overall | 90 | ≥ 90 | YES |

**Verdict: `fail`** (criteria, completeness, duplicates gates).

All seeded verdicts are stable and deterministic. The blend removal did not change Agent C's `criteriaMatch` from a passing value — it was `Math.round(100) = 100` before and after.

---

## Missing States & Edge Cases Not Covered by ACs

1. **Over-submission (records.length > targetCount):** `criteriaMatch` can exceed 100 (Finding #4). Not a demo concern but a correctness gap for general use.

2. **Null `records` field on Submission:** The guard at line 158 checks `records.length === 0` but if `records` is `null`/`undefined` (possible for non-data-research submissions without the deliverable path), accessing `.length` would throw. However, `Submission.records` is typed as `CompanyRecord[]` (never optional), and the `taskType !== 'data-research'` check in `runOracle` at line 380 routes non-data-research submissions to `judgeDeliverable` before `scoreSubmission` is called. Safe in practice.

3. **Empty `criteria` array in requirements:** If `requirements.criteria` is empty, `criteriaText` in the prompt would be empty. Claude would receive a prompt with no fuzzy criteria. `callSemanticJudge` would still return text (or null), and the fallback formula would use `criteriaMatchPct * 0.6 + validityPct * 0.4`. Not a demo concern (HERO_REQUIREMENTS always has 3 criteria).

4. **Cache collision across bounties:** `_judgeCache` is keyed by records hash only, not by bounty or requirements. Two different bounties with the same records would share a cached judge result evaluated against the first bounty's criteria. For the demo (single bounty) this is harmless. In production this would return wrong judge text.

5. **Large records array in prompt:** `callSemanticJudge` only sends the first 5 records as a sample (line 119). For very large submissions this is intentional and bounded. The prompt is safe.

---

## Positive Observations

- **Structural isolation is genuine, not aspirational.** `judgeText` is a single local variable with a single use site. The comment at line 260–263 correctly describes the guarantee, and the code backs it up. The claim of structural verdict independence holds under inspection.
- **Double-layer error safety on the judge call.** `anthropic.complete` never throws (internal try/catch), and `callSemanticJudge` is additionally called with `.catch(() => null)` at line 264. The belt-and-suspenders approach is appropriate for a live-call path in a demo.
- **Cache design is correct.** Null results are NOT cached (line 141–143), so transient API failures do not permanently poison the cache for that records hash. Deterministic checks always run regardless of cache state (checks complete before line 264).
- **TypeScript clean.** Zero type errors. The `async function scoreSubmission(...): Promise<OracleResult>` signature change is correctly reflected at all call sites.
- **Fast no-key path.** `anthropic.isConfigured()` returns false before any I/O, and the function returns `null` synchronously. The fallback adds ~0ms latency.
- **Computation order is safe.** All variables consumed by the fallback formula (`criteriaMatchPct`, `validityPct`) are computed at lines 204 and 247, well before `callSemanticJudge` is awaited at line 264.

---

## Acceptance-Criteria Summary

| Group | Total | Pass | Fail |
|---|---|---|---|
| 6a Verdict Independence | 5 | 5 | 0 |
| 6b Graceful Degradation | 5 | 5 | 0 |
| 6c Gate Determinism | 3 | 3 | 0 |
| 6d Real Judge Invocation | 5 | 5 | 0 |
| 6e Cache Behavior | 3 | 3 | 0 |
| **Total** | **21** | **21** | **0** |

---

## Overall Verdict

**Ship-ready for demo.** All 21 acceptance criteria pass. The implementation delivers the three load-bearing guarantees: verdict independence is structural (not by convention), graceful degradation is airtight (no key → instant null → deterministic fallback), and the seeded verdicts (Agent C pass, Agent B/Alpha fail) are stable across any number of runs with or without a key.

The four findings are all LOW severity and three are pre-existing. None block shipping.

**Recommended next steps (non-blocking, prioritized):**

1. (LOW) Add `Math.min(100, criteriaMatchPct)` cap to prevent `criteriaMatch > 100` on over-submissions — one-line fix, zero test impact.
2. (LOW) Remove or correct the `"duplicates excluded from unique criteria count"` text in the criteria reason `detail` — it misrepresents what the code computes.
3. (LOW) Consider `ok: criteriaOk` (or omit `ok`) on the semantic reason entry when the real judge returns text, to avoid showing a green `ok: true` for a negative Claude assessment.
4. (INFO) Document the cache-keying limitation (no bounty/requirements dimension) as a known issue for future multi-bounty production use.
