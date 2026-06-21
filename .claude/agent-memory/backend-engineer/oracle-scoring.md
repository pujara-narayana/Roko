---
name: oracle-scoring
description: Oracle PASS gate, sub-score formula, seeded verdict outcomes, and LLM-judge integration
metadata:
  type: project
---

Oracle at `lib/oracle/index.ts`. PASS gate: completeness >= 95 AND criteriaMatch >= 90 AND validity >= 90 AND overall >= 90 AND duplicates == 0.

Sub-score formulas (post LLM-judge integration):
- criteriaMatch = Math.round(criteriaMatchPct)  — deterministic ONLY, judge has NO role here
- completeness = min(records.length / targetCount, 1) * 100 - dupCount * 5
- validity = validEmailCount / records.length * 100
- overall = criteriaMatch * 0.35 + completeness * 0.35 + validity * 0.30

Seeded outcomes (unchanged by judge):
- agent-alpha: FAIL (3 low-revenue companies + 3 duplicate entries)
- agent-beta: FAIL (5 invalid emails: malformed + fake domain)
- agent-charlie: PASS (20/20, 0 duplicates, all valid emails, overall=100)

LLM-judge integration (as of 2026-06-21):
- `callSemanticJudge()` is async, private to `lib/oracle/index.ts`
- Calls `anthropic.complete(prompt, { maxTokens: 80, temperature: 0.2, timeoutMs: 12_000 })`
- Returns a single evaluative sentence, or null on any failure
- Judge output appears ONLY in `reasons[]` as `criterionId: 'semantic'` — never in any gate arithmetic
- No-key / timeout / error fallback: `detail: "Semantic judge unavailable — scored from deterministic signals: N/100"` (fallback formula: criteriaMatchPct * 0.6 + validityPct * 0.4, display only)
- In-memory cache keyed by SHA-256 of JSON-serialized records array; perf-only, never changes any gate
- `scoreSubmission` is now `async` returning `Promise<OracleResult>`
- `runOracle` calls `scoreSubmission(s, requirements)` directly (was `Promise.resolve(...)`)
