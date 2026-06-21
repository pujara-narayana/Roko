# Run Plan — Redis Layer

**Request (restated):** Build a real Redis persistence layer for the Bounty marketplace
that backs the leaderboard, escrow ledger, agent reputation, bounties, submissions, and
oracle results — replacing the simulated in-memory store as the source of truth *when
Redis is configured*, while preserving the existing demo path (and the existing
synchronous store interface) when it is not.

**Project:** `Roko` — Next.js 16 App Router + TypeScript + Tailwind v4. Existing
in-memory singleton store at `lib/store/index.ts` already simulates Redis primitives
(hand-rolled `SortedSet` with `zadd`/`zincrby`/`zrevrange`/`zscore`/`zrank`, plus maps
for bounties/agents/escrows/runs/submissions/oracle results). Backend lives in
`/app/api/*` route handlers; pipeline orchestration in `lib/pipeline.ts`.

**Spec source:** `requirements.md` §6 (Redis is a committed sponsor track:
*"leaderboard (sorted sets), escrow ledger state, agent reputation, submission cache,
bounty/agent matching"*) and §4 NFR (*"Redis … writes must be asynchronous/non-blocking
so they never add user-visible latency"*). Google Slides deck was auth-gated/unreadable;
per user decision we proceed from `requirements.md`.

## User decisions (Checkpoint 0)
- **Slides:** proceed from `requirements.md` (deck inaccessible).
- **Posture:** dual-mode — real Redis behind the same store interface, auto-fallback to
  in-memory when `REDIS_URL` is unset. Honors the established "demo must run with no
  keys" rule and the non-blocking NFR.
- **Target:** generic `redis://` / `rediss://` via the `redis` Node client (works with
  Redis Cloud free tier, local Redis, or Docker).

## Selected phases
| Phase | Agent | Artifact | Runs? | Why |
|-------|-------|----------|-------|-----|
| 1 Validate  | market-validator-researcher | 01-research.md | **no** | Pure infra; scope fixed by `requirements.md`. Nothing to validate. |
| 2 Define    | product-manager             | 02-prd.md      | **no** | Scope is crisp and derivable; orchestrator embeds machine-checkable acceptance criteria below instead of spawning a PM. |
| 3 Design    | ux-designer                 | 03-ux-spec.md  | **no** | No user-facing surface; UI is untouched. |
| 4 Build (BE)| backend-engineer            | 04a-backend-plan.md | **yes** | Designs the Redis-backed store + writes the code. |
| 4 Build (FE)| frontend-engineer           | 04b-frontend-plan.md | **no** | Store interface is preserved; no component or API-shape change. |
| 5 Review    | qa-reviewer                 | 05-qa-review.md | **yes** | Code is produced; review against the acceptance criteria below. |

**Build sequencing:** single engineer (backend only) — no parallelism needed. The
backend-engineer first writes `04a-backend-plan.md` (chosen architecture + key map),
then implements.

## Acceptance criteria (the contract — QA tests against these)
- [ ] **AC1 — Optional & safe:** With `REDIS_URL` unset, the app behaves exactly as
  today (in-memory), logs a clear "Redis not configured, using in-memory store" notice,
  and the full demo loop runs. No new *required* env keys.
- [ ] **AC2 — Real connection:** With a valid `REDIS_URL` (`redis://` or `rediss://`),
  the layer connects via the `redis` client and reports connected status on
  `GET /api/health`.
- [ ] **AC3 — Leaderboard is a real sorted set:** Agent reputation is stored in a Redis
  sorted set; reputation changes on verified completion are reflected in Redis, and
  `GET /api/leaderboard` returns the Redis-ordered ranking.
- [ ] **AC4 — Durable state:** Bounties, agents, escrows, submissions, and oracle
  results are persisted to Redis; with Redis configured, this state survives a process
  restart (hydrated on boot; seeded only if empty).
- [ ] **AC5 — Non-blocking writes:** Redis writes never add user-visible latency to the
  request path and never throw to callers — failures are logged and degrade gracefully
  (per NFR §4). Reads on the demo hot path stay synchronous.
- [ ] **AC6 — Interface preserved:** The existing synchronous store API consumed by the
  16 importers (`store.getEscrow`, `store.incrementReputation`, etc.) keeps its
  signatures; no API route handler signature changes.
- [ ] **AC7 — Resilient connection:** A bad `REDIS_URL` or an unreachable/down Redis
  does not crash the app — it logs and falls back to in-memory.
- [ ] **AC8 — Builds clean:** `npm run build` (typecheck included) passes.

## Recommended architecture (for the backend-engineer to confirm in 04a)
The store is consumed **synchronously** by 16 files and escrow logic mutates objects by
reference. A full async refactor would ripple risk through every route. Recommended
instead: **in-memory store stays the synchronous source of truth on the hot path;
Redis is a write-through mirror** (fire-and-forget, non-blocking) **plus boot-time
hydration**. This satisfies dual-mode, the non-blocking NFR, interface preservation, and
durability simultaneously. The backend-engineer owns the final call and documents it.

**Checkpoints:** 1 (this plan + acceptance criteria) · ~~2~~ folded into 1 (no
planning phases ran) · 3 (post-QA).
**Open questions for the user:** none — three blocking decisions resolved at Checkpoint 0.
