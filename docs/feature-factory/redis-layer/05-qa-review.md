# QA Review — Redis Persistence Layer

## Scope reviewed

Files reviewed: `lib/redis/client.ts`, `lib/redis/mirror.ts`, `lib/redis/hydrate.ts`,
`lib/store/index.ts`, `lib/seed/init.ts`, `app/api/health/route.ts`, `.env`, `package.json`.
Reference docs: `00-run-plan.md` (AC1–AC8), `04a-backend-plan.md` (architecture + key map).
Build result from plan: `npm run build` PASS per the engineer's log (not re-run here; AC8 treated as reported-pass pending the bugs below).

---

## Findings (prioritized)

| # | Severity | Area | Issue | Location | Suggested fix |
|---|----------|------|-------|----------|---------------|
| 1 | **Critical** | AC4 Durability | Fixture seed always runs synchronously before async hydration, and its `store.setAgent()`/`store.setBounty()` calls fire mirror writes that overwrite Redis with seed defaults. Hydration then reads the corrupted data. On every process restart with Redis configured, all accumulated state (reputation gains, escrow changes, etc.) is erased. | `lib/seed/init.ts` lines 29–44 | Do not call `runFixtureSeed()` synchronously at the bottom; let the `.then()` / `.catch()` callbacks be the only callers. Serve an empty store on the first request rather than transiently seeding before hydration resolves, OR defer `runFixtureSeed` after hydration resolves if Redis returned false. |
| 2 | **High** | AC4 Durability | `appendEvent()` mutates `run.events` in-memory but never calls `mirrorRun()`. The plan states "Run events array is stored inside the Run JSON blob so they hydrate together", but `setRun` is called once at run creation with `events: []` and subsequent `appendEvent` calls are never mirrored. After a process restart, all events added during a run are lost from Redis. | `lib/store/index.ts` line 133 | Add `mirrorRun(run).catch(() => {})` at the end of `appendEvent()` (after the mutation and SSE notify). |
| 3 | **High** | AC3/AC4 Data integrity | `incrementReputation()` calls `mirrorReputation(agentId, score)` — which updates only the leaderboard sorted-set score — but does not call `mirrorAgent(agent)` to update the `agent:{id}` hash. After hydration, the in-memory leaderboard ranking is correct (sorted-set scores survive), but `agent.reputation` read from the hash is stale (reset to the value at the last `setAgent` call). The `/api/leaderboard` endpoint surfaces `reputationScore: agent.reputation` directly from the agent object. | `lib/store/index.ts` line 108 | After `mirrorReputation(...)`, also fire `mirrorAgent(agent).catch(() => {})` — or add a lightweight `mirrorAgentReputation` that patches only the `data` field of `agent:{id}`. |
| 4 | **Medium** | Versioning | `package.json` specifies `"redis": "^6.0.0"` but the backend plan references the `redis` v4 client. The code uses `zAdd`, `hSet`, `sAdd`, `zRangeWithScores`, `sMembers`, and `hGet` — all of which exist in v6 with the same camelCase names and compatible signatures. The `{ score, value }` member shape used in `zAdd` matches v6's `SortedSetMember`. `RedisClientType` is re-exported from v6. `socket.connectTimeout` and `reconnectStrategy` remain valid. No runtime breakage detected, but the version bump is undocumented. | `package.json` / `04a-backend-plan.md` | Update `04a-backend-plan.md` to document v6 explicitly. Add a comment in `client.ts` noting the installed version. No code change required unless a v6-specific behavioral change surfaces. |
| 5 | **Low** | AC2 Health | `getRedisStatus()` returns `'fallback'` (its initial value) until `initRedis()` is called. Since `initRedis()` is triggered only via `hydrateFromRedis()` → `seedStore()`, a cold request to `GET /api/health` before any other route has been hit will report `redis: 'fallback'` even with `REDIS_URL` set, while `store` reports `'in-memory+redis'`. The inconsistency resolves as soon as any data route fires. | `app/api/health/route.ts` | Either call `initRedis()` directly inside the `GET /api/health` handler (it is idempotent), or accept this transient inconsistency as a known demo limitation. |
| 6 | **Low** | Code quality | Each mirror function (e.g., `mirrorBounty`) checks `getRedis()` at the top of its body, then delegates to `hset()` and `sadd()` helpers that each call `getRedis()` again. The outer check is redundant since the helpers guard themselves. | `lib/redis/mirror.ts` lines 47–56 | Remove the redundant outer `getRedis()` null checks in each entity mirror function, or promote the helpers to accept a `redis` argument passed from the outer function. No user-visible impact either way. |

---

## Acceptance-criteria check

| AC | Pass/Fail | Evidence |
|----|-----------|---------|
| **AC1 — Optional & safe** | PASS | `REDIS_URL` not set: `initRedis()` returns early after logging the configured message; `getRedis()` returns `null`; all mirror functions guard with `if (!redis) return`. Import chain has no side effects at module load. Demo path unaffected. |
| **AC2 — Real connection** | PASS (conditional) | `client.ts` uses `createClient({ url })` + `client.connect()` with the `redis` npm client; `'connected'` status emitted on both `connect` and `ready` events; health endpoint surfaces `getRedisStatus()`. Note: health may briefly report `'fallback'` before first data-route hit (finding #5). |
| **AC3 — Leaderboard is a real sorted set** | PARTIAL FAIL | `mirrorAgent` and `mirrorReputation` both call `redis.zAdd('leaderboard', { score, value: agentId })` — a real Redis `ZADD`. Ranking in Redis is correct. However, after `incrementReputation()`, the `agent:{id}` hash retains the pre-increment reputation value (finding #3). Hydration restores correct sorted-set ordering but surfaces stale `agent.reputation` in the API response. |
| **AC4 — Durable state** | FAIL | Two bugs break durability: (a) the unconditional synchronous fixture seed always runs before hydration, firing mirror writes that overwrite Redis state on every restart (finding #1 — Critical); (b) `appendEvent()` never mirrors run events, so all pipeline events are lost from Redis on restart (finding #2). |
| **AC5 — Non-blocking writes** | PASS | Every mirror call is issued as `mirrorXxx(...).catch(() => {})` from synchronous store methods. Mirror functions are `async` with internal `try/catch` and never rethrow. No `await` on the hot path. Redis reads are confined to boot-time hydration. |
| **AC6 — Interface preserved** | PASS | All store method signatures (`setBounty`, `setAgent`, `incrementReputation`, `setEscrow`, `setRun`, `appendEvent`, `setSubmission`, `setOracleResult`, `setOracleBatch`, and all getters) are unchanged. No API route handler signatures changed. |
| **AC7 — Resilient connection** | PASS | `initRedis()` wraps `createClient()` and `client.connect()` in a single `try/catch`; errors set `_client = null` and `_status = 'fallback'`. Error events downgrade status without rethrowing. `reconnectStrategy` caps retries at 10. No path throws to the caller. |
| **AC8 — Builds clean** | PASS (engineer-reported) | Engineer reports `npm run build` passes with zero TypeScript errors. redis v6 API usage is type-compatible. `import type { RedisClientType } from 'redis'` is valid (v6 re-exports it from `@redis/client`). |

---

## Missing states / edge cases

**Hydration partial-failure state not surfaced.** If `hydrateFromRedis()` succeeds for agents/bounties but fails mid-flight during escrow hydration (e.g., a network blip mid-call), the catch block logs and returns `false`, triggering `runFixtureSeed()`. The partially-hydrated state (some agents loaded, some not) is then overwritten by fixture defaults. This is an acceptable tradeoff for demo robustness but should be documented as a known limitation.

**Redis reconnect exhaustion state.** After `reconnectStrategy` returns an `Error` (>10 retries), the Redis client closes permanently. `_status` remains `'disconnected'`. Subsequent mirror calls call `getRedis()` which returns the now-closed `_client` (not null — `_client` was set before the first error). Mirror functions will then throw on every call; the `try/catch` swallows these, but at a higher log volume than expected. Fix: in the `'end'` event handler (or reconnect-limit branch), set `_client = null` so `getRedis()` returns null and mirror functions exit early instead of attempting commands on a dead connection.

**First-request race — empty store visible.** With Redis configured but slow to respond, the fix for finding #1 (removing the synchronous seed) would leave the store empty until hydration completes. Any SSR or API request hitting within that window sees empty data. The current code avoids this by always seeding synchronously, at the cost of the corruption bug. The fix must either (a) block on hydration before the first request (not compatible with current Next.js route-level `seedStore()` pattern), or (b) seed synchronously without mirroring (disable mirror calls during the seed phase), then let hydration overwrite. Option (b) is the minimal fix.

**`oracle_batch` individual results double-mirrored.** `mirrorOracleBatch` spreads `batch.results.map(r => mirrorOracleResult(r))` into `Promise.all` alongside the batch hash. `setOracleBatch` in the store also calls `mirrorOracleBatch`. But `setOracleResult` is called individually before `setOracleBatch` in the oracle pipeline — meaning each `OracleResult` is mirrored twice on the batch path. This is idempotent (same key, same data written twice) so it is not a correctness bug, but it doubles Redis write traffic for oracle results.

---

## Verdict

**fix-then-ship** — route to backend-engineer.

The durability story (AC4) is broken by two bugs: the seed/hydration race (Critical) and the missing `appendEvent` mirror (High). A third High finding means reputation data shown in the API after a restart will be stale. These are not demo-blocking in a single-process no-restart demo run, but they mean the Redis layer does not deliver on its core value proposition (persistence across restarts). AC3 is partially broken in the same way.

**Route findings #1, #2, #3 back to backend-engineer.** Findings #4–#6 can be addressed in the same pass or deferred.

**High-priority items spelled out for the engineer:**

1. **Finding #1 (Critical — `lib/seed/init.ts`):** Remove the unconditional synchronous `runFixtureSeed()` at the bottom of `seedStore()`. Instead, seed without mirror calls during the startup grace period, or restructure so the seed path is guarded: only run if hydration returns false AND only after the async result is known. The cleanest fix: make `seedStore()` async, `await hydrateFromRedis()`, and call `runFixtureSeed()` only if it returns false — then refactor call sites to fire-and-forget the async `seedStore()`. Alternatively, disable mirror calls in `runFixtureSeed` during startup (e.g., by checking a `_hydrating` flag in `getRedis()`).

2. **Finding #2 (High — `lib/store/index.ts` `appendEvent`):** Add `mirrorRun(run).catch(() => {})` after `run.events.push(event)`. The mirror will serialize the full Run (including the updated events array) to Redis on every event — this is frequent but each write is fire-and-forget and non-blocking.

3. **Finding #3 (High — `lib/store/index.ts` `incrementReputation`):** Add `mirrorAgent(agent).catch(() => {})` after `mirrorReputation(agentId, agent.reputation).catch(() => {})`. This ensures the agent hash in Redis stays in sync with the in-memory reputation value.
