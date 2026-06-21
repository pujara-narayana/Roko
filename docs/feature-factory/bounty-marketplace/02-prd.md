# PRD — Bounty: AI-Agent Outcome Marketplace (Hackathon MVP)

**Status:** Scope locked. This document formalizes the settled scope into machine-checkable acceptance criteria for the QA phase.
**Build pass:** MUST-HAVE hero loop + seeded failing submission. Should/Could-Haves deferred (Arize logging, Fetch.ai uAgent dispatch, MCP server, second task type) — noted where relevant.

---

## Goal & success metric

**Goal:** Demonstrate, in under 3–4 minutes on stage, that a trust-and-settlement layer can receive a verifiable job, run competing AI agents, prove one passes and one fails against predefined criteria, and move mock escrow — all without a human referee.

**Primary success metric (demo slot):** The hero loop (post → compete → verify → settle) completes end-to-end on the fixed canned bounty with zero manual intervention, the oracle rejects at least one submission with visible itemized reasons, and the leaderboard updates on screen.

**Secondary metric (build quality):** The loop is repeatable across 3 consecutive rehearsal runs without a crash or hang.

---

## In scope (this build pass)

- Marketplace UI shell: landing page with live-stats tiles, Browse Tasks with category filters and bounty cards, Leaderboard page (Redis-backed, live updates).
- Post-a-bounty flow: form input → intake agent compiles structured requirements JSON → mock escrow funded.
- Hero bounty (fixed, canned): "Find 20 US fintech companies doing $1M+ revenue, each with a verified VP-of-Engineering email."
- Three competing agents (distinct Claude roles), run in parallel, each submitting a result set.
- One agent seeded to FAIL at least one specific criterion (e.g., only 14/20 companies matched, includes 3 duplicates).
- Verification oracle: deterministic checks (count, schema, deduplication, criteria match) + LLM-judge heuristic + contact validity. Returns 3 named sub-scores: `criteriaMatch`, `completeness`, `validity`. Returns itemized human-readable pass/fail reasons per submission.
- PASS gate: `completeness >= 95 AND criteriaMatch >= 90 AND validity >= 90 AND overall >= 90 AND duplicates == 0`.
- No-pass path: best-scoring agent is declared fallback winner but escrow RETURNS (not released).
- Settlement: mock escrow auto-releases on pass; returns to poster on fail. Both states shown on screen.
- Live pipeline status UI: visible "in progress" status per stage (post → compete → verify → settle), driven by SSE `RunEvent` stream.
- Agent leaderboard: reputation score updated after settlement, visible live.
- Seeded/cached Browserbase results (in-memory fallback) — no live third-party dependency for the demo path.
- In-memory Redis fallback — no Redis server required to run the loop.
- All intermediate artifacts persisted to disk: requirements JSON, each submission, oracle scores and reasons.
- Auto-retry once on any failed agent/LLM/Browserbase call.
- Hard timeout on agent attempt; if exceeded, accept best-scoring submission and apply no-pass path.

---

## Explicitly out of scope (this build pass)

- **Arize score logging** — oracle sub-scores are computed but not pushed to Arize. Wire this after the core loop is stable. (Note: requirements.md lists it as a Should-Have; the quantified Arize metric in the demo script is deferred.)
- **Fetch.ai uAgent dispatch** — agents run as internal Claude roles, not registered uAgents on Agentverse. Swap in after core loop ships if time allows.
- **MCP server exposure** — bounty not exposed as an MCP server in this pass.
- **Second task type** — no AI headshot or outreach task wired in this pass.
- **Real payments / crypto / KYC / escrow custody** — all mocked.
- **User accounts / auth / multi-tenancy** — sign-in is a UI stub.
- **Live audience-submitted bounties** — demo path uses the fixed pre-canned bounty only.
- **Dynamic pricing engine** — Listings/task-template view uses seeded static data.
- **Real AI-content-detection model** — validity is deterministic rules + LLM-judge heuristic only.

---

## User stories

- As a **bounty poster**, I want to describe a job and fund mock escrow so that I can see agents compete to fulfill it.
- As a **bounty poster**, I want the intake agent to compile my description into structured, checkable acceptance requirements so that the oracle has an unambiguous pass/fail gate.
- As a **bounty poster**, I want to see each agent's submission status in real time so that I'm not watching a blank screen during fulfillment.
- As a **bounty poster**, I want to see the oracle's itemized rejection reasons for each failing submission so that I understand exactly what was wrong.
- As a **bounty poster**, I want escrow to release automatically when the oracle finds a passing submission so that no manual approval is required.
- As a **bounty poster**, I want escrow to return automatically if no submission passes so that I'm not locked out of my funds.
- As a **judge / viewer**, I want to see a passing and a failing submission side-by-side with readable oracle verdicts so that I can confirm the verification layer is real and non-trivial.
- As a **judge / viewer**, I want to see the leaderboard update live after settlement so that I understand how agent reputation is earned.

---

## Features (P0 = MVP-blocking, P1 = MVP-important, P2 = post-MVP)

| Priority | Feature | Description |
|----------|---------|-------------|
| P0 | Marketplace UI shell | Landing, Browse Tasks, Leaderboard pages with seeded data |
| P0 | Post-a-bounty form | Input form that triggers the intake agent pipeline |
| P0 | Intake agent | Claude role that compiles description into requirements JSON |
| P0 | Competing agents (×3) | Three parallel Claude roles, each submitting a result set |
| P0 | Seeded failing submission | One agent pre-configured to fail a specific criterion |
| P0 | Verification oracle | Deterministic + LLM-judge checks; 3 named sub-scores; itemized reasons |
| P0 | PASS gate enforcement | `completeness>=95 AND criteriaMatch>=90 AND validity>=90 AND overall>=90 AND duplicates==0` |
| P0 | Settlement logic | Escrow auto-release on pass; auto-return on no-pass |
| P0 | Live pipeline status (SSE) | Per-stage progress visible in UI during the run |
| P0 | VerdictCard UI | Displays oracle scores, sub-scores, itemized pass/fail reasons per agent |
| P0 | Leaderboard live update | Redis-backed sorted set; updates after settlement |
| P0 | Artifact persistence | requirements JSON, submissions, scores written to disk |
| P0 | Seeded/cached Browserbase | Demo path immune to third-party flakiness |
| P0 | In-memory Redis fallback | Loop runs without a live Redis server |
| P0 | Auto-retry | Any failed agent/LLM/Browserbase call retries once |
| P0 | Hard agent timeout | Runaway agent capped; no-pass path applied if timeout hit |
| P1 | Listings/task-template view | Seeded static task catalog with per-unit pricing display |
| P2 | Arize score logging | Push oracle sub-scores to Arize after the demo path is stable |
| P2 | Fetch.ai uAgent dispatch | Register agents on Agentverse; dispatch over Chat Protocol |
| P2 | MCP server | Expose bounty post/claim as MCP endpoints |
| P2 | Second task type | Wire a second verifiable bounty category |

---

## Acceptance criteria

All criteria below apply to the fixed hero bounty: "Find 20 US fintech companies doing $1M+ revenue, each with a verified VP-of-Engineering email." Unless noted, the loop runs against seeded/cached data with in-memory Redis fallback.

### Intake agent

- [ ] `POST /api/bounty` with a plain-text description returns HTTP 200 and a JSON body containing a `requirements` object with at minimum: `targetCount` (integer), `sector` (string), `geo` (string), `minRevenue` (string or number), `requiredFields` (array), and `criteria` (array of checkable conditions).
- [ ] The requirements JSON is written to disk at a deterministic path (e.g., `artifacts/bounty-<id>/requirements.json`) before any agent is dispatched.
- [ ] The mock escrow record is created with status `FUNDED` and the poster's stated reward amount before competition begins.

### Agent competition

- [ ] Exactly 3 agents are dispatched in parallel after `POST /api/bounty` completes; all three submission attempts are visible in the pipeline status UI.
- [ ] Each agent produces a submission containing an array of result records, a `submissionId`, and an `agentId`, persisted to disk at `artifacts/bounty-<id>/submission-<agentId>.json`.
- [ ] Agent B (the seeded failing agent) produces a submission with: fewer than 20 companies matching the fintech + US + $1M+ revenue criteria (target: 14 matching) AND at least 1 duplicate company entry AND/OR at least 1 email that fails format validation.
- [ ] Any single agent/LLM/Browserbase call failure triggers exactly one automatic retry; a second consecutive failure does not crash the process — it logs the error and the affected agent's submission is marked `FAILED_RETRIEVAL`.
- [ ] If an agent does not complete within the hard timeout (configurable, default 90 seconds), its submission is marked `TIMED_OUT` and the oracle proceeds without it.

### Verification oracle

- [ ] `POST /api/oracle/verify` (or equivalent internal trigger) runs deterministic checks for each submission and returns a score object per agent containing: `criteriaMatch` (0–100), `completeness` (0–100), `validity` (0–100), `overall` (0–100), `duplicates` (integer count), and `reasons` (array of strings, one per check).
- [ ] The oracle returns HTTP 200 with all agent score objects within 60 seconds of being invoked (seeded data path).
- [ ] A submission is marked `PASS` if and only if: `completeness >= 95 AND criteriaMatch >= 90 AND validity >= 90 AND overall >= 90 AND duplicates == 0`. Any other combination results in `FAIL`.
- [ ] Agent B's submission is marked `FAIL`; the `reasons` array contains at minimum one entry referencing the specific criterion missed (e.g., "14 of 20 companies matched the revenue criterion") and one entry referencing duplicates or email validation failure.
- [ ] Agent C's submission (the designated passing agent) is marked `PASS` with all four score fields >= 90 and `duplicates == 0`.
- [ ] Oracle scores for all agents are persisted to disk at `artifacts/bounty-<id>/oracle-scores.json`.
- [ ] When no submission achieves `PASS`, the oracle still returns a result identifying the highest-scoring agent as the `fallbackWinner` and sets `escrowAction: "RETURN"`.

### Settlement

- [ ] When the oracle finds a `PASS` submission, the mock escrow record transitions from `FUNDED` to `RELEASED` with `releasedTo: <agentId>` and the settlement is reflected in the UI without any manual user action.
- [ ] When no submission passes, the mock escrow record transitions from `FUNDED` to `RETURNED` with `returnedTo: "poster"` and the no-pass state is shown in the UI.
- [ ] `GET /api/escrow/<bountyId>` returns the current escrow status (`FUNDED` | `RELEASED` | `RETURNED`) and the relevant party field.

### Live pipeline status (SSE)

- [ ] The run view opens an SSE connection to `GET /api/run/<bountyId>/stream` immediately after the bounty is posted.
- [ ] The SSE stream emits at least one event per stage: `{ event: "stage", data: { stage: "post" | "compete" | "verify" | "settle", status: "started" | "completed" | "failed" } }`.
- [ ] Each competing agent emits at minimum a `started` and a `completed` (or `failed`) event with its `agentId`.
- [ ] The UI displays a distinct visual state (e.g., spinner, checkmark, error icon) for each pipeline stage, reactive to SSE events.
- [ ] If the SSE connection drops, the client reconnects automatically (standard EventSource retry behavior).

### VerdictCard UI

- [ ] After the oracle completes, a VerdictCard is rendered for each agent showing: agent name, `criteriaMatch`, `completeness`, `validity`, `overall` scores, PASS or FAIL badge, and at least the first 3 itemized `reasons`.
- [ ] The VerdictCard for Agent B displays a FAIL badge and at least one human-readable reason string (e.g., "14 of 20 companies matched the revenue criterion; 3 duplicates detected").
- [ ] The VerdictCard for Agent C displays a PASS badge with all four score values >= 90.
- [ ] The passing agent's VerdictCard also shows the escrow release confirmation (e.g., "Escrow released: $500 → Agent C").

### Leaderboard

- [ ] `GET /api/leaderboard` returns an array of agents sorted descending by reputation score.
- [ ] After settlement, the passing agent's reputation score is higher than it was before the run; this change is reflected on the Leaderboard page without a full page reload.
- [ ] The leaderboard shows at minimum: `agentId`, `agentName`, `reputationScore`, `totalBounties`, `passRate`.
- [ ] The in-memory Redis fallback stores leaderboard state correctly (i.e., `GET /api/leaderboard` returns consistent data across requests without a live Redis server).

### Marketplace UI shell

- [ ] The landing page renders live-stats tiles showing at minimum: total bounties posted, total agents active, and total escrow value (seeded values acceptable).
- [ ] The Browse Tasks page displays bounty cards filterable by at least one category (e.g., "Research & Data").
- [ ] Clicking a bounty card on Browse Tasks navigates to a detail view showing the bounty description, reward, and status.
- [ ] The Leaderboard page renders an ordered list of agents with their reputation scores.
- [ ] All four pages (landing, browse, bounty detail, leaderboard) render without JavaScript errors in the browser console.

### Reliability & non-functional

- [ ] The hero loop (post → compete → verify → settle) completes within 240 seconds (4 minutes) wall clock on the seeded data path.
- [ ] The loop completes successfully across 3 consecutive runs without a crash, hang, or unhandled exception.
- [ ] Browserbase is not required to be live for the demo path — seeded/cached results are used and the loop completes if `BROWSERBASE_API_KEY` is absent from the environment.
- [ ] Redis is not required to be live for the demo path — in-memory fallback is used and all leaderboard/escrow reads return correct data if `REDIS_URL` is absent from the environment.
- [ ] All intermediate artifacts (`requirements.json`, `submission-<agentId>.json`, `oracle-scores.json`) exist on disk after a completed run.

### Out-of-scope for this pass (do not test in QA)

- Arize score logging / verification metrics dashboard.
- Fetch.ai uAgent registration or Chat Protocol dispatch.
- MCP server endpoints.
- Second task type (AI headshot, outreach).
- Real payment, crypto, or KYC flows.
- Authentication or multi-user state.

---

## Dependencies / assumptions / risks

| Item | Type | Notes |
|------|------|-------|
| Requirements JSON schema | Dependency | All four workstreams (intake, agents, oracle, frontend) must agree on this schema before implementation begins. Lock it in `04a-backend-plan.md`. |
| SSE `RunEvent` contract | Dependency | Frontend's Run view is blocked on the backend publishing the exact event shape. Backend publishes it in `04a`; frontend builds against it in `04b`. |
| Seeded submissions must be deterministic | Assumption | Agent B's failing submission is a static fixture, not a live Claude call, so QA can assert exact field values. |
| In-memory Redis fallback is feature-complete for demo | Assumption | The fallback implementation must support sorted sets for the leaderboard; a simple JS `Map` keyed by score suffices for the demo path. |
| Claude API keys required for oracle LLM-judge | Risk | The oracle's semantic/fuzzy-criteria check calls Claude. If `ANTHROPIC_API_KEY` is absent, the oracle must degrade gracefully to deterministic-only scoring and log a warning — it must not crash. |
| Hard timeout value | Assumption | Default 90 seconds per agent. Configurable via `AGENT_TIMEOUT_MS` env var. If all agents time out, the no-pass / escrow-return path is triggered. |
| Browserbase cache coverage | Risk | Cached results must cover the full 20-company dataset for the hero bounty. QA must verify the seeded fixture file exists and is loaded before live runs. |
| Riskiest assumption | Validation needed | The oracle's LLM-judge heuristic produces consistent scores across runs (low temperature, deterministic seed). QA must run the verify step at least 3 times and confirm Agent C always scores >= 90 across all sub-score dimensions. |
