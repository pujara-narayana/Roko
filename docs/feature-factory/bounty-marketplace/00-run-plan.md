# Run Plan — Bounty: AI-Agent Outcome Marketplace (Hackathon MVP)

**Request (restated):** Implement the full Bounty hero loop — post → compete → verify → settle — as a one-shot hackathon demo, per `requriements.md` and the established per-agent memory (product scope, locked "Marbled Ink" design, API/SSE contracts, QA scoring gates).

**Project:** Greenfield. Next.js (App Router) + TypeScript + Tailwind. Claude API (intake+oracle = opus, competitors = haiku), Browserbase, Arize, Redis (in-memory fallback). Repo currently has only `requriements.md`, agent-memory, and an image — no code scaffold yet.

**Spec source:** `requriements.md` + `.claude/agent-memory/*` (all six roles have prior memory).

## Selected phases
| Phase | Agent | Artifact | Runs? | Why |
|-------|-------|----------|-------|-----|
| 1 Validate  | market-validator-researcher | 01-research.md | **no** | Already validated; findings live in `agent-memory/market-validator-researcher`. No unproven bet to re-test. |
| 2 Define    | product-manager             | 02-prd.md      | **yes (light)** | Consolidate requirements + memory into machine-checkable acceptance criteria QA tests against. Not yet on disk. |
| 3 Design    | ux-designer                 | 03-ux-spec.md  | **yes (light)** | Formalize 5 screens, flows, and required empty/loading/error/success states. Visual identity already locked. |
| 4 Build (BE)| backend-engineer            | 04a-backend-plan.md | **yes** | Implement intake, competing agents, oracle, escrow, Redis, and the SSE run stream — the live pipeline backbone. |
| 4 Build (FE)| frontend-engineer           | 04b-frontend-plan.md | **yes** | Implement the 5 screens, centerpiece Run view (SSE → pipeline + VerdictCard), Marbled-Ink system. |
| 5 Review    | qa-reviewer                 | 05-qa-review.md | **yes** | Code was produced; verify against acceptance criteria + scoring gates + demo-breaking risk areas. |

**Build sequencing:** **backend-first.** The frontend's centerpiece (Run view) consumes a live SSE `RunEvent` stream and REST contracts. Those contracts are *specified* in memory but not yet *implemented*; backend publishes them in `04a` (and stub/seed data), then frontend builds against a real running API. Planning phases 2 & 3 run **in parallel** in one turn — scope is fully locked by `requriements.md`, so UX does not need to wait on the PRD.

**Checkpoints:** 1 (this plan) · 2 (post-planning PRD+UX, pre-build) · 3 (post-QA)

**Open questions for the user:**
1. **Live external services vs. seeded:** For the demo, do you want real Claude API + Browserbase + Arize + Redis wired now (needs API keys in `.env`), or build fully against seeded/cached fixtures + in-memory fallback first and wire real keys later? (Requirements mandate cached fallback regardless.)
2. **Scope depth for this pass:** Build only the **Must-Have** hero loop, or also pull in the high-value **Should-Haves** (Arize sub-score logging, a deliberately-failing seeded submission, second task type)? The seeded-failure is already core to the demo, so I plan to include it regardless.
