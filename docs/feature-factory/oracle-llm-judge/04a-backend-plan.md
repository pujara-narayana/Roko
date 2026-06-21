# Backend Plan — Oracle Real LLM-Judge

**Feature:** Replace stubbed `semanticScore` in `lib/oracle/index.ts` with a real low-temperature Claude semantic judge for fuzzy criteria, while preserving verdict determinism and graceful degradation.

**Plan owner:** backend-engineer  
**PRD ref:** `docs/feature-factory/oracle-llm-judge/02-prd.md`  
**Resolved decisions ref:** `docs/feature-factory/oracle-llm-judge/00-run-plan.md`

---

## Data Model

No schema changes. `OracleResult`, `OracleSubScores`, and `OracleReason` types in `lib/types.ts` are **frozen** per PRD § Out of Scope. The semantic judge output surfaces via the existing `OracleReason[]` array using `criterionId: 'semantic'` — no new typed fields.

The one structural change: the existing `OracleReason` entry that currently carries `kind: 'criteria'` for the semantic score will remain exactly that shape. No new fields are required because `kind`, `ok`, `detail`, and `criterionId` already cover the needed signal.

---

## API Contracts

**Unchanged.** No API routes are modified. `scoreSubmission`'s return type is still `Promise<OracleResult>` (was `OracleResult` synchronously — this is an internal caller contract change, not a public API change). The only caller is `runOracle` in the same file, which already wraps the call.

---

## Services / Business Logic

### Judge service (new function: `callSemanticJudge`)

Extracted as a module-private async function in `lib/oracle/index.ts`. Responsibility: given a records array and requirements, call `anthropic.complete(...)` and return a single evaluative sentence, or `null` on any failure.

**Design decisions:**
- Temperature `0.2` — matches `enrich()` in `lib/oracle/judge.ts` (see AC-RJ-4).
- `timeoutMs: 12_000` — matches AC-RJ-5 and the 240-second hero loop budget.
- `maxTokens: 80` — the judge returns one sentence; no need for more.
- Prompt includes: the bounty's `criteria[].semantic` fields (the fuzzy criteria text) and a representative sample of the submitted records (first 5 names + revenue), so Claude evaluates against actual content, not generic heuristics.
- Returns `null` on: key not configured, API error, timeout, empty/degenerate reply (< 10 chars — same guard as `enrich()`).
- Never throws — all error paths are caught internally.

**In-memory cache (module-scope `Map`):**
- Key: SHA-256 hex digest of the JSON-serialized `records` array (via `crypto.createHash`).
- Stores: the judge's text string only (never a score, never gate inputs).
- Hit: the cached string is returned directly; all deterministic checks still run on every call regardless.
- Miss: calls `anthropic.complete`, stores result if non-null.
- Cache is intentionally ephemeral (process-scope); never persisted.

### Gate-decoupling (the core constraint)

The existing `criteriaMatch` computation at line 212 of `lib/oracle/index.ts`:
```ts
// BEFORE (violates verdict independence):
const criteriaMatch = Math.min(100, Math.round(criteriaMatchPct * 0.7 + semanticPct * 0.3));
```

becomes:
```ts
// AFTER (deterministic only — judge cannot affect this):
const criteriaMatch = Math.round(criteriaMatchPct);
```

The `semanticScore()` helper function is removed. The judge's text output is stored only in the `OracleReason` entry for `criterionId: 'semantic'` — it never touches `criteriaMatch`, `completeness`, `validity`, `overallScore`, or `duplicates`.

### `scoreSubmission` made async

Function signature changes from `function scoreSubmission(...): OracleResult` to `async function scoreSubmission(...): Promise<OracleResult>`.

The one caller, `runOracle`, currently wraps it as `Promise.resolve(scoreSubmission(...))` — this is updated to `await scoreSubmission(...)`.

### Fallback semantic display value

When the judge returns `null` (no key / timeout / error), the `semanticScore` fallback formula (`criteriaMatchPct * 0.6 + validityPct * 0.4`) is preserved as a display integer **only** — it feeds `detail` text in the reason entry, never any gate. The reason entry `detail` will read: `"Semantic judge unavailable — scored from deterministic signals: N/100"` (satisfies AC-GD-4).

### Structural guarantee of verdict independence

The judge's return value (`judgeText: string | null`) is referenced in exactly **one** place: the `reasons.push(...)` call that constructs the `criterionId: 'semantic'` entry. A TypeScript reader can verify this by grep: no variable carrying `judgeText` or `semanticInsight` appears in any arithmetic expression that feeds `criteriaMatch`, `completeness`, `validity`, `overallScore`, or `dupCount`. This is enforced by code structure, not convention.

---

## Sequencing

1. Remove `semanticScore()` helper function.
2. Add `callSemanticJudge()` async function with cache + fallback.
3. Make `scoreSubmission` async; `await callSemanticJudge(...)` before gate computation.
4. Rewrite `criteriaMatch = Math.round(criteriaMatchPct)` — remove blend.
5. Replace the old `reasons.push(...)` for `criterionId: 'semantic'` with judge output or fallback.
6. Update `runOracle` to `await scoreSubmission(...)`.
7. Run `npx tsc --noEmit`.

---

## Implementation Log

### Files modified

| File | Change |
|------|--------|
| `lib/oracle/index.ts` | Main edit: `scoreSubmission` made async, `semanticScore()` replaced by `callSemanticJudge()`, `criteriaMatch` gate decoupled, `runOracle` updated to `await scoreSubmission(...)`. |

### Files created

None — the judge logic is colocated in `lib/oracle/index.ts` per the "surgical, in surrounding code style" constraint.

### Verification

- `npx tsc --noEmit`: **PASS** — see report in summary section.
- AC-VI-1: `criteriaMatch = Math.round(criteriaMatchPct)` — no judge variable in expression. Confirmed by grep.
- AC-VI-4: `judgeText` variable appears only in `reasons.push(...)`. Confirmed by inspection.
- AC-RJ-4: `temperature: 0.2` at call site. Confirmed.
- AC-RJ-5: `timeoutMs: 12_000` at call site. Confirmed.
- AC-GD-4: Fallback `detail` text set to `"Semantic judge unavailable — scored from deterministic signals: N/100"`. Confirmed.
- AC-CA-1: Cache stores judge text only; deterministic checks run unconditionally before judge call. Confirmed by code structure.

---

### QA Fix — 2026-06-21 (findings #1 and #2)

**Finding 1 fix (line ~270, judge-present branch `ok: true` hardcoded).**
Introduced a local boolean `semanticDisplayOk = criteriaOk && validityOk && dupOk` computed
from the three deterministic gate variables that are already in scope at that point. Both the
judge-present branch and the fallback branch now set `ok: semanticDisplayOk` instead of their
previous independent expressions. This means the semantic reason's checkmark is `true` only
when the submission clears its criteria predicate gate, email validity gate, AND duplicate gate —
identical semantics to the hard gates, 100% deterministic, and structurally incapable of varying
across runs because `judgeText` does not appear in the expression.

**Finding 2 fix (line ~281, fallback branch `ok: fallbackDisplay >= 90` could be `true` on failing submissions).**
The same `semanticDisplayOk` variable is used in the fallback branch, replacing `fallbackDisplay >= 90`.
For Agent Beta (`validity=75`, `validityOk=false`), `semanticDisplayOk` evaluates to `false`,
so the semantic reason now shows `ok: false` — consistent with Beta's `verdict: fail`.
The `fallbackDisplay` integer is still computed and still appears in the `detail` string unchanged.

**Non-gating guarantee preserved.** `semanticDisplayOk` feeds only `reasons.push(...).ok`.
It does not appear in `criteriaMatch`, `completeness`, `validity`, `overallScore`, `duplicates`,
or `allGatesPassed`. Verdict determinism and seeded outcomes (Agent C PASS, Agent B/Alpha FAIL) are unchanged.

**TypeScript:** `npx tsc --noEmit` exits clean (no output, exit 0).
