# Run Plan — Oracle Real LLM-Judge

**Request (restated):** Replace the verification oracle's stubbed semantic score
(`lib/oracle/index.ts` `semanticScore`, derived purely from deterministic checks)
with a genuine low-temperature Claude semantic judge for fuzzy criteria — while
preserving demo determinism so the seeded hero-loop verdicts (Agent C passes,
Agent B fails) never flip, and degrading gracefully to deterministic-only scoring
when `ANTHROPIC_API_KEY` is absent.

**Project:** Existing codebase. Next.js (App Router) + TypeScript + Tailwind. Oracle
lives in `lib/oracle/index.ts` (data-research path) and `lib/oracle/judge.ts`
(deliverable path). Claude access via `lib/providers/anthropic.ts`; Arize logging via
`lib/providers/arize.ts`. `OracleResult` / `OracleSubScores` types in `lib/types.ts`.

**Spec source:** `requriements.md` (§3 oracle requirements, §4 non-functional
determinism), existing `docs/feature-factory/bounty-marketplace/02-prd.md`, and the
current oracle implementation. This is an enhancement of shipped code, not greenfield.

## Selected phases
| Phase | Agent | Artifact | Runs? | Why |
|-------|-------|----------|-------|-----|
| 1 Validate  | market-validator-researcher | 01-research.md | **no** | Product already validated; no unproven bet in swapping a stub for a real call. |
| 2 Define    | product-manager             | 02-prd.md (addendum) | **yes (light)** | Pin machine-checkable acceptance criteria for the semantic judge: determinism guardrails, fallback behavior, how the real judge blends into the `criteriaMatch` sub-score without flipping seeded verdicts. |
| 3 Design    | ux-designer                 | 03-ux-spec.md  | **no** | No user-facing surface change. `OracleResult` shape is unchanged; VerdictCard already renders reasons + sub-scores. |
| 4 Build (BE)| backend-engineer            | 04a-backend-plan.md | **yes** | The core work: implement the real low-temperature Claude semantic judge, integrate it into `scoreSubmission`/`runOracle`, with deterministic fallback + caching for the seeded path. |
| 4 Build (FE)| frontend-engineer           | 04b-frontend-plan.md | **no** | No contract change; frontend untouched. |
| 5 Review    | qa-reviewer                 | 05-qa-review.md | **yes** | Code produced. Verify against acceptance criteria and hammer the riskiest assumption — verdict stability across ≥3 consecutive runs, and clean degradation with no API key. |

**Build sequencing:** **backend-only** — no frontend, so no parallelism needed. One
engineer, one build artifact, then QA.

**Checkpoints:** 1 (this plan) · 2 (post-PRD-addendum, pre-build) · 3 (post-QA)

**Resolved decisions (Checkpoint 1):**
1. **Verdict authority — deterministic gate is binding everywhere.** The live Claude
   judge enriches the semantic sub-score and the human-readable reasons, but the
   pass/fail verdict is determined by the deterministic checks alone
   (count/completeness, dedup, criteria predicate, email validity). The judge can
   *never* flip a verdict in either direction.
   - **Implementation constraint:** the gated sub-scores (`criteriaMatch`,
     `completeness`, `validity`, `overall`, `duplicates`) must be computed from
     deterministic values **only**. The semantic judge's output must NOT feed any
     gated quantity. Today `semanticPct` is blended into `criteriaMatch`
     (`criteriaMatchPct*0.7 + semanticPct*0.3`) — that blend must be reworked so the
     judge cannot cross the `criteriaMatch >= 90` gate. Surface the semantic result as
     its own non-gating signal (display value + reasons), or blend it only into a
     non-gated overall-quality readout.
2. **Seeded demo path — same rules as ad-hoc.** No special-casing of the hero bounty.
   It runs through the identical judge path; it stays stable on stage *because* the
   deterministic gates bind, not because of a hard-coded verdict.
3. **Caching is a perf optimization only, never a verdict override.** Backend may
   cache the live judge response keyed by submission-content hash to save tokens /
   latency across rehearsals, but caching must not change any verdict or gate outcome.

**Demo-determinism note for QA:** since the judge has no verdict authority, the
riskiest assumption shifts from "does the verdict stay stable" (now guaranteed by
construction) to "does the deterministic gate computation stay independent of the
judge" — QA must confirm a degenerate/low/empty judge response cannot move
`criteriaMatch` or any gate.
