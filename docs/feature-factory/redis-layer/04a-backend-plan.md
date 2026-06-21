# Backend Plan — Redis Persistence Layer

## Architecture Decision

**Chosen: In-memory store as synchronous source of truth + Redis write-through mirror + boot-time hydration.**

This is the recommended architecture from the Run Plan and the correct choice for this codebase. The reasons are firm:

1. The store is consumed **synchronously** by 16 files. Refactoring every call site to `await store.getBounty(id)` would touch every route handler and introduce async bugs across the pipeline's event sequencing — too much risk for a hackathon codebase with a live demo path.
2. The non-blocking NFR (§4) is naturally satisfied: Redis writes fire-and-forget and never sit on the request hot path.
3. Dual-mode (AC1 + AC7) is trivially implemented: if `REDIS_URL` is absent or the connection fails, the in-memory store is already fully populated and the app continues unchanged.
4. Boot-time hydration (AC4 — durability) reloads all persisted maps from Redis hash keys and restores the leaderboard sorted set on the next process startup.

**What was rejected:** Making Redis the primary async store and wrapping the synchronous interface with blocking queues or Promises — this would require changing every caller signature (violating AC6) and would add latency on every read (violating §4 NFR).

---

## Data Model

All data shapes are defined in `lib/types.ts`. Redis stores exact JSON serializations of the TypeScript interfaces; no schema transformation.

### Redis Key Map

| Key pattern | Redis type | Contents | TTL |
|---|---|---|---|
| `bounty:{bountyId}` | Hash (single JSON field `data`) | JSON-serialized `Bounty` | none |
| `agent:{agentId}` | Hash (single JSON field `data`) | JSON-serialized `Agent` | none |
| `escrow:{bountyId}` | Hash (single JSON field `data`) | JSON-serialized `Escrow` | none |
| `run:{runId}` | Hash (single JSON field `data`) | JSON-serialized `Run` (including events array) | none |
| `submission:{submissionId}` | Hash (single JSON field `data`) | JSON-serialized `Submission` | none |
| `oracle_result:{submissionId}` | Hash (single JSON field `data`) | JSON-serialized `OracleResult` | none |
| `oracle_batch:{bountyId}` | Hash (single JSON field `data`) | JSON-serialized `OracleBatchResult` | none |
| `leaderboard` | Sorted Set | member=agentId, score=reputation | none |
| `index:bounties` | Set | all bountyId values (for hydration scan) | none |
| `index:agents` | Set | all agentId values (for hydration scan) | none |
| `index:escrows` | Set | all bountyId values keyed to escrow (for hydration scan) | none |
| `index:runs` | Set | all runId values (for hydration scan) | none |
| `index:submissions` | Set | all submissionId values (for hydration scan) | none |
| `index:oracle_results` | Set | all submissionId values (for hydration scan) | none |
| `index:oracle_batches` | Set | all bountyId values keyed to oracle batches | none |

**Namespace rationale:** Flat, human-readable keys over a hash namespace. Single-level `:` delimiter is conventional Redis. No prefix needed since this is a dedicated app database; easy to add `roko:` prefix if multi-tenant later.

**Leaderboard is a real sorted set:** `ZADD leaderboard <score> <agentId>` on every `setAgent` and `incrementReputation` call. `ZREVRANGE leaderboard 0 -1` on hydration. This satisfies AC3 with a genuine Redis sorted-set, not a JSON blob.

---

## API / Contracts

No new HTTP endpoints added. One endpoint modified:

| Method | Path | Change | Response addition |
|---|---|---|---|
| GET | /api/health | Updated | `redis` field now reports `configured \| connected \| disconnected \| fallback` |

Health response shape (new):
```json
{
  "ok": true,
  "data": {
    "status": "healthy",
    "ts": "...",
    "version": "1.0.0",
    "store": "in-memory+redis",
    "redis": "connected",
    "redisMode": "write-through",
    "browserbase": "configured"
  }
}
```

---

## Services / Business Logic

### `lib/redis/client.ts` — Lazy singleton Redis client

- Imports `redis` Node client only if `REDIS_URL` is set (env-guard per the established rule in `project-bounty-stack.md`).
- Exposes: `getRedis(): RedisClientType | null` (returns null if not configured or if connection failed).
- Exposes: `getRedisStatus(): 'configured' | 'connected' | 'disconnected' | 'fallback'`.
- Connection errors are caught, logged, and set the client to null — the rest of the app never sees an exception.
- The client is a module-level singleton; subsequent calls return the same instance.

### `lib/redis/mirror.ts` — Write-through mirror

- All write functions are `async` and wrapped in try/catch; errors are logged, never rethrown.
- Called from `lib/store/index.ts` methods as fire-and-forget (`mirrorXxx(...).catch(() => {})`).
- Functions: `mirrorBounty`, `mirrorAgent`, `mirrorEscrow`, `mirrorRun`, `mirrorSubmission`, `mirrorOracleResult`, `mirrorOracleBatch`.
- `mirrorAgent` additionally does `ZADD leaderboard <score> <agentId>` and `SADD index:agents <agentId>`.
- `mirrorReputation` does `ZADD leaderboard <score> <agentId>` (replaces, not increments — we store the canonical score from in-memory, so no double-counting risk).

### `lib/redis/hydrate.ts` — Boot-time hydration

- Called from `lib/seed/init.ts` before seeding.
- Returns `true` if Redis was configured and had data (skip seed), `false` otherwise (run seed normally).
- Loads all entities from index sets → hash reads → populates in-memory store.
- Restores the leaderboard sorted set from `ZREVRANGE leaderboard 0 -1 WITHSCORES`.
- SSE subscriber map is not hydrated (ephemeral per-process state — in-flight connections can't survive a restart anyway).
- Run events array is stored inside the `Run` JSON blob so they hydrate together.

### `lib/store/index.ts` — Augmented with mirror calls

- Every `setXxx` and `incrementReputation` call fires the corresponding `mirrorXxx` as fire-and-forget after the synchronous in-memory write.
- Synchronous interface is 100% unchanged (AC6).

---

## Sequencing & Migration Notes

1. `npm install redis` — adds `^4.x` (the `redis` v4 Node client with Promise API and TypeScript types built-in).
2. Write `lib/redis/client.ts`.
3. Write `lib/redis/mirror.ts`.
4. Write `lib/redis/hydrate.ts`.
5. Update `lib/store/index.ts` — add mirror calls after each write.
6. Update `lib/seed/init.ts` — call `hydrateFromRedis()` before seeding; skip seed if data found.
7. Update `app/api/health/route.ts` — report real Redis status.
8. Add `REDIS_URL` entry (commented, optional) to `.env`.
9. Run `npm run build` — verify clean.

No database migrations required (Redis is schema-free). No existing data to migrate (in-memory store is always fresh on restart; Redis hydration replaces seeded data going forward when `REDIS_URL` is configured).

---

## Implementation Log

### Files created
- `lib/redis/client.ts` — lazy singleton Redis client with env-guard and connection resilience
- `lib/redis/mirror.ts` — fire-and-forget write-through mirror functions
- `lib/redis/hydrate.ts` — boot-time hydration from Redis into in-memory store

### Files modified
- `lib/store/index.ts` — mirror calls added after each write method
- `lib/seed/init.ts` — hydration check before seeding
- `app/api/health/route.ts` — real Redis status reporting
- `.env` — `REDIS_URL` entry added (commented, optional)
- `package.json` — `redis` dependency added

### Build result
- `npm run build` — PASS. Compiled successfully in 3.3s. TypeScript clean in 5.1s. All 22 routes rendered (16 dynamic, 6 static). Zero type errors. With `REDIS_URL` unset the app logs "Redis not configured, using in-memory store only" during page data collection and continues normally (AC1 confirmed).

### QA fix pass (2026-06-21)

Three high-priority durability bugs from `05-qa-review.md` findings #1–#3 fixed. Build re-confirmed: `npm run build` PASS, compiled in 3.2s, TypeScript clean in 4.8s, all routes rendered, zero type errors.

**Finding #1 — Critical: Seed/hydration race (`lib/seed/init.ts`)**
Replaced the two-phase approach (synchronous `runFixtureSeed()` followed by async hydration that could overwrite) with a three-phase approach that eliminates the race:
1. `seedInMemory()` — writes fixtures directly to the store's public maps (`.agents`, `.bounties`, `.escrows`, `.leaderboard`) without calling the store's public `setXxx()` methods, so no mirror calls fire. This ensures the first request always sees data.
2. `hydrateFromRedis(store)` — async, runs concurrently. If Redis had data it overwrites the fixture defaults in-memory; Redis wins and `mirrorFixtures()` is never called.
3. `mirrorFixtures()` — called only when hydration returns false (Redis was empty or unconfigured). Iterates the already-seeded maps and fires `mirrorAgent/mirrorBounty/mirrorEscrow` fire-and-forget calls so fixtures are durable on the next restart. No-op when `REDIS_URL` is unset (all mirror calls guard on `getRedis() === null`).
The old unconditional synchronous `runFixtureSeed()` at line 44 (which called `store.setAgent()` etc., triggering mirror calls before hydration ran) is removed entirely. AC1 preserved: no `REDIS_URL` path is unchanged in behavior.

**Finding #2 — High: `appendEvent()` never mirrors (`lib/store/index.ts` line 136)**
Added `mirrorRun(run).catch(() => {})` immediately after `run.events.push(event)` in `appendEvent()`. The full `Run` object (with the appended event in its `events` array) is now mirrored to Redis on every event, not just on initial `setRun()`. This ensures pipeline events are durable across restarts. Call is fire-and-forget (AC5 preserved); mirror function has internal try/catch and never throws (AC7 preserved).

**Finding #3 — High: `incrementReputation()` leaves agent hash stale (`lib/store/index.ts` line 112)**
Added `mirrorAgent(agent).catch(() => {})` immediately after the existing `mirrorReputation(agentId, agent.reputation).catch(() => {})` in `incrementReputation()`. `mirrorReputation` updates only the leaderboard sorted set; `mirrorAgent` now also updates the `agent:{id}` hash so the stored JSON (including the `reputation` field) stays consistent with the sorted-set score. After hydration the `agent.reputation` value read from the hash will match the leaderboard rank. Call is fire-and-forget (AC5 preserved).
