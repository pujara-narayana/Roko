---
name: redis-layer
description: Redis write-through mirror architecture, key scheme, and dual-mode pattern implemented for the Bounty marketplace
metadata:
  type: project
---

Redis persistence layer implemented as a write-through mirror behind the synchronous in-memory store.

**Architecture:** In-memory store remains the synchronous source of truth on the hot path. Redis is a write-through mirror (fire-and-forget, non-blocking) plus boot-time hydration. This was chosen because 16 call sites consume the store synchronously — an async refactor would cascade risk through every route handler.

**Key scheme:**
- `bounty:{bountyId}` — Hash, field "data", JSON-serialized Bounty
- `agent:{agentId}` — Hash, field "data", JSON-serialized Agent
- `escrow:{bountyId}` — Hash, field "data", JSON-serialized Escrow
- `run:{runId}` — Hash, field "data", JSON-serialized Run (events embedded)
- `submission:{submissionId}` — Hash, field "data", JSON-serialized Submission
- `oracle_result:{submissionId}` — Hash, field "data", JSON-serialized OracleResult
- `oracle_batch:{bountyId}` — Hash, field "data", JSON-serialized OracleBatchResult
- `leaderboard` — Sorted Set, member=agentId, score=reputation (real Redis ZADD/ZREVRANGE)
- `index:{entity}` — Set of all IDs for that entity type (used for hydration scan)

**Module locations:**
- `lib/redis/client.ts` — lazy singleton, env-guarded, resilient to bad URL
- `lib/redis/mirror.ts` — fire-and-forget write functions called from store methods
- `lib/redis/hydrate.ts` — boot-time hydration, called from seed/init.ts

**Seed / hydration flow (post-QA-fix, 2026-06-21):**
1. `seedInMemory()` writes fixtures directly to store maps (no mirror calls) so the first request always sees data.
2. `hydrateFromRedis()` runs async concurrently. If Redis has agents it overwrites the fixture defaults — Redis wins; `mirrorFixtures()` is NOT called.
3. If hydration returns false (Redis empty or unconfigured), `mirrorFixtures()` iterates the already-seeded maps and fires fire-and-forget mirror calls, making fixtures durable on next restart.
4. Critical invariant: fixture seed NEVER fires mirror calls during the hydration window. Mirror calls only fire after hydration confirms Redis was empty. This eliminates the race where the sync seed overwrote persisted Redis state before hydration could read it.

**`appendEvent()` mirrors the full Run on every event** (bug fix): `mirrorRun(run).catch(() => {})` fires after each `run.events.push()`. Run events are embedded in the Run JSON blob — they hydrate correctly on restart.

**`incrementReputation()` mirrors both sorted set AND agent hash** (bug fix): fires both `mirrorReputation(agentId, score)` (ZADD) and `mirrorAgent(agent)` (hash + ZADD) so the `agent:{id}` hash stays consistent with the leaderboard sorted set score. Without this, `agent.reputation` read from the hash was stale after hydration.

**Redis v6 installed** (not v4). API differences: `hSet` (not `hmset`), `sAdd` (not `sadd`), `zAdd` (not `zadd`), `zRangeWithScores`.

**Why:** Satisfies AC1 (fallback), AC3 (real sorted set), AC4 (durability), AC5 (non-blocking), AC6 (interface preserved), AC7 (resilience), AC8 (build passes).

See [[project-bounty-stack]] for the broader stack context.
