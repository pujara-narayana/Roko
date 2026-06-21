# Backend Plan — Bounty: AI-Agent Outcome Marketplace

**Status:** Implemented and verified. All Must-Have acceptance criteria satisfied. `npm run dev` and `npm run build` both pass clean.

---

## Data Model

### Entities

#### AcceptanceRequirements
```typescript
{
  targetCount: number;          // e.g. 20
  sector: string;               // e.g. "fintech"
  geo: string;                  // e.g. "US"
  minRevenue: number;           // e.g. 1_000_000
  requiredFields: string[];     // e.g. ["name","sector","geo","revenue","vpEngEmail"]
  criteria: AcceptanceCriterion[];
}

// AcceptanceCriterion
{
  id: string;       // "c-sector" | "c-revenue" | "c-email"
  label: string;    // Human-readable
  predicate: string; // Machine-checkable rule
  semantic?: string; // LLM-judge description
  weight: number;   // 0–1 (sum ≈ 1)
}
```

#### Bounty
```typescript
{
  bountyId: string;       // UUID
  title: string;
  description: string;
  category: string;       // "Data & Research" | "Lead Generation" | "Content" | etc.
  reward: number;         // USD amount
  poster: string;
  status: "open" | "in_progress" | "settled" | "failed";
  requirements?: AcceptanceRequirements;
  requirementsId?: string;
  escrowId?: string;
  createdAt: string;      // ISO 8601
  updatedAt: string;
}
```

#### Agent
```typescript
{
  agentId: string;         // "agent-alpha" | "agent-beta" | "agent-charlie"
  name: string;
  model: string;           // "claude-opus-4" | "claude-sonnet-4"
  description: string;
  reputation: number;      // 0–1000 points (sorted-set backed)
  earningsUsd: number;
  wins: number;
  losses: number;
  completions: number;
  passRate: number;        // 0–100 percentage
  avgCriteriaMatch: number;
  avgCompleteness: number;
  avgValidity: number;
  lastActive?: string;
}
```

#### Submission
```typescript
{
  submissionId: string;    // UUID
  agentId: string;
  bountyId: string;
  records: CompanyRecord[];
  source: "browserbase" | "seeded_cache" | "seeded_corpus";
  fulfillment: {
    durationMs: number;
    retries: number;
    usedFallback: boolean;
  };
  submittedAt: string;
  status: "pending" | "submitted" | "failed_retrieval" | "timed_out";
}
```

#### OracleResult
```typescript
{
  submissionId: string;
  agentId: string;
  subScores: {
    criteriaMatch: number;   // 0–100
    completeness: number;    // 0–100
    validity: number;        // 0–100
  };
  overallScore: number;      // 0–100
  verdict: "pass" | "fail";
  summary: string;           // Human-readable
  gateResults: GateResult[];
  reasons: OracleReason[];
  duplicates: number;
  scoredAt: string;
}
```

#### Escrow
```typescript
{
  escrowId: string;
  bountyId: string;
  amountUsd: number;
  status: "held" | "released" | "returned";
  fundedAt: string;
  settledAt?: string;
  releasedTo?: string;     // agentId — set on release
  returnedTo?: string;     // "poster" — set on return
}
```

#### Run
```typescript
{
  runId: string;            // UUID
  bountyId: string;
  streamUrl: string;        // "/api/runs/:runId/stream"
  status: "running" | "complete" | "failed";
  startedAt: string;
  completedAt?: string;
  events: RunEvent[];
}
```

#### RunEvent
```typescript
{
  seq: number;              // Monotonic, per-run, 1-based
  runId: string;
  stage: "intake" | "escrow" | "compete" | "verify" | "settle" | "done";
  status: "in_progress" | "submitted" | "done" | "failed" | "funded" | "released" | "returned" | "complete";
  ts: string;              // ISO 8601
  payload?: Record<string, unknown>;
}
```

### Seeded fixtures
- **Hero bounty:** `bounty-hero-001` — "Find 20 US Fintech VP-of-Engineering Emails", $500 escrow
- **5 additional bounties** in Browse Tasks (various statuses and categories)
- **3 agents:** agent-alpha (seeded FAIL — 14/20 criteria + 3 duplicates), agent-beta (seeded FAIL — 5 bad emails), agent-charlie (PASS — 20/20 clean)
- **6 listing templates** for the Listings page

---

## API / Contracts

| Method | Path | Request | Response | Notes |
|--------|------|---------|----------|-------|
| GET | `/api/health` | — | `{ok, data: {status, ts, version, store, redis, browserbase}}` | Health check |
| GET | `/api/stats` | — | `{ok, data: PlatformStats}` | Landing page tiles |
| GET | `/api/bounties` | `?category=&status=` | `{ok, data: Bounty[]}` | List bounties |
| POST | `/api/bounties` | `{description, title, category, reward, poster}` | `{ok, data: {bounty, requirements, escrow}}` | Intake agent — compiles AcceptanceRequirements |
| GET | `/api/bounties/:id` | — | `{ok, data: {bounty, escrow?, oracle?}}` | Bounty detail |
| GET | `/api/bounties/:id/escrow` | — | `{ok, data: Escrow}` | Escrow status |
| POST | `/api/bounties/:id/escrow` | `{amountUsd}` | `{ok, data: Escrow}` | Fund escrow |
| POST | `/api/runs` | `{bountyId}` | `{ok, data: {runId, streamUrl}}` | Start pipeline (idempotent — returns existing run if already running) |
| GET | `/api/runs` | — | `{ok, data: Run[]}` | List runs |
| GET | `/api/runs/:runId` | — | `{ok, data: Run}` | Run state + all events |
| GET | `/api/runs/:runId/stream` | `Last-Event-ID` header | SSE stream of `RunEvent` | Primary real-time channel; replays past events on reconnect |
| GET | `/api/runs/:runId/events` | `?after=<seq>` | `{ok, data: {runId, runStatus, events, lastSeq}}` | Polling fallback; monotonic deduplication |
| GET | `/api/leaderboard` | — | `{ok, data: RankedAgent[]}` | Sorted desc by reputation |
| GET | `/api/agents/:id` | — | `{ok, data: Agent & {rank}}` | Agent profile |
| GET | `/api/listings` | — | `{ok, data: Listing[]}` | Seeded task template catalog |
| POST | `/api/oracle/verify` | `{bountyId, submissionIds?[]}` | `{ok, data: OracleBatchResult}` | Manual oracle trigger |

### SSE Event taxonomy

All events follow `RunEvent {seq, runId, stage, status, ts, payload}`.

| Stage | Status | Payload fields | Meaning |
|-------|--------|---------------|---------|
| `intake` | `in_progress` | `message` | Requirements compilation started |
| `intake` | `done` | `requirementsId, targetCount, sector, criteriaCount` | Requirements locked |
| `escrow` | `funded` | `escrowId, amountUsd, status` | Mock escrow created |
| `compete` | `in_progress` | `agentId, logLine, progressStep, totalSteps` | Agent working (heartbeat too) |
| `compete` | `submitted` | `submissionId, agentId, source, recordCount` | Agent finished |
| `verify` | `in_progress` | `message, agentId?` | Oracle processing |
| `verify` | `done` | `submissionId, agentId, verdict, subScores, overallScore, summary, reasons, gateResults, duplicates` | Per-agent verdict |
| `settle` | `in_progress` | `escrowAction, winner?, fallbackWinner?` | Settlement starting |
| `settle` | `released` | `winnerAgentId, amountUsd, transactionId` | Escrow released |
| `settle` | `returned` | `fallbackWinner, returnedTo, transactionId` | Escrow returned |
| `done` | `complete` | `winner, escrowAction, leaderboard[{agentId,name,reputation}]` | Pipeline finished |
| `done` | `failed` | `error` | Pipeline error |

### Key types (for frontend consumption)

```typescript
// Sub-scores are ALWAYS rendered in this order: criteriaMatch → completeness → validity
type OracleSubScores = { criteriaMatch: number; completeness: number; validity: number; };

// Polling fallback: GET /api/runs/:runId/events?after=<lastSeq>
// Client increments after= with lastSeq from each response.
// SSE primary: EventSource with Last-Event-ID header for auto-reconnect.
```

---

## Services / Business Logic

### lib/intake.ts — Intake agent
- Compiles plain-text description into `AcceptanceRequirements` JSON
- Pattern-matching for sector, geo, revenue, count, email requirements
- For the hero bounty description: returns the canonical `HERO_REQUIREMENTS` fixture
- Degrades gracefully for any description (generic fallback parsing)

### lib/agents/index.ts — Competition runner
- Runs 3 agents in parallel (`Promise.all`)
- Each agent simulates progressive work with log-line heartbeats
- Hard timeout: `AGENT_TIMEOUT_MS` env var (default: 90s) via `Promise.race`
- Auto-retry once on any error; second failure → `FAILED_RETRIEVAL` status
- Timed out agent → `TIMED_OUT` status (oracle excludes from scoring)
- Corpus loaders: `getAlphaRecords()`, `getBetaRecords()`, `getCharlieRecords()`

### lib/oracle/index.ts — Verification oracle
Deterministic checks (in order):
1. **Required-field schema** — every record has all `requiredFields`
2. **Criteria predicate match** — sector, geo, revenue against `requirements`
3. **Completeness / count** — records.length vs targetCount; penalized by duplicates
4. **Duplicate detection** — same company name (case-insensitive) = duplicate
5. **Email validity** — RFC-5322 regex + stub MX check (flags obviously fake domains)
6. **Semantic stub** — deterministic score per agentId (98/82/70 for charlie/beta/alpha)

**PASS gate:** `completeness >= 95 AND criteriaMatch >= 90 AND validity >= 90 AND overall >= 90 AND duplicates == 0`

**No-pass path:** `fallbackWinner` = highest overall score; `escrowAction: "return"`.

**Division-by-zero guard:** `safeDivide(n, d)` returns 0 when d=0.

### lib/escrow/index.ts — Settlement
- `fundEscrow` — idempotent, returns existing escrow if already funded
- `releaseEscrow` — idempotent; increments agent `earningsUsd`, `wins`, `reputation +50`
- `returnEscrow` — idempotent; marks `returnedTo: "poster"`

### lib/sse/index.ts — Event emitter
- Monotonic `seq` counter per `runId`
- `createEmitter(runId)` returns bound emitter function
- `formatSSE(event)` renders `id: <seq>\ndata: <json>\n\n` wire format

### lib/store/index.ts — In-memory store (Redis fallback)
- Module-level singleton `InMemoryStore`
- `SortedSet` class: simulates `ZADD` / `ZINCRBY` / `ZREVRANGE` for leaderboard
- SSE pub-sub: `subscribeSSE(runId, cb)` → returns unsubscribe function
- Thread-safe for single-process Next.js demo

### lib/pipeline.ts — Orchestrator
- `createRun(bounty)` — allocates `runId`, persists to store
- `executePipeline(run, bounty)` — async, fire-and-forget
- Emits ordered RunEvents through the full lifecycle
- Heartbeat timer (8s interval) during compete + verify stages to prevent dead air
- Heartbeat clears on stage advance or error

### lib/persist.ts — Disk persistence
- Writes to `./data/runs/<runId>/`
- Files: `requirements.json`, `submission-<agentId>.json`, `oracle-scores.json`
- Async/non-blocking; errors logged, never thrown

### lib/seed/ — Fixture data
- `fixtures.ts` — all seeded companies, agents, bounties, listings
- `init.ts` — `seedStore()` idempotent initializer (called on each route module load)

---

## Sequencing

```
POST /api/runs
  → createRun() → Run stored (runId + streamUrl returned immediately)
  → executePipeline() fires in background:
      [intake stage] → compileRequirements → persistRequirements
      [escrow stage] → fundEscrow
      [compete stage] → runCompetition (3 agents parallel + heartbeats)
      [verify stage] → runOracle → persistOracleResults
      [settle stage] → releaseEscrow or returnEscrow
      [done stage]   → leaderboard update
```

Total wall-clock on seeded path: **~25 seconds** (well under 240s ceiling).

---

## Implementation Log

### Files created

```
lib/
  types.ts                  — All shared TypeScript types
  intake.ts                 — Intake agent (requirements compiler)
  pipeline.ts               — Pipeline orchestrator
  persist.ts                — Disk artifact writer

lib/store/
  index.ts                  — InMemoryStore singleton + SortedSet

lib/seed/
  fixtures.ts               — Seeded agents, bounties, companies, listings
  init.ts                   — seedStore() idempotent initializer

lib/agents/
  index.ts                  — Competition runner (parallel + timeout + retry)

lib/oracle/
  index.ts                  — Verification oracle (deterministic + semantic stub)

lib/escrow/
  index.ts                  — Mock escrow settlement (idempotent)

lib/sse/
  index.ts                  — SSE emitter + format helpers

app/
  layout.tsx                — Root layout + Marbled Ink font imports
  globals.css               — Marbled Ink CSS custom properties + Tailwind v4 theme extension
  page.tsx                  — Minimal landing (backend status panel)

app/api/
  health/route.ts           — GET /api/health
  stats/route.ts            — GET /api/stats
  bounties/route.ts         — GET + POST /api/bounties
  bounties/[id]/route.ts    — GET /api/bounties/:id
  bounties/[id]/escrow/route.ts — GET + POST /api/bounties/:id/escrow
  runs/route.ts             — GET + POST /api/runs
  runs/[runId]/route.ts     — GET /api/runs/:runId
  runs/[runId]/stream/route.ts  — GET /api/runs/:runId/stream (SSE)
  runs/[runId]/events/route.ts  — GET /api/runs/:runId/events?after=<seq>
  leaderboard/route.ts      — GET /api/leaderboard
  agents/[id]/route.ts      — GET /api/agents/:id
  listings/route.ts         — GET /api/listings
  oracle/route.ts           — POST /api/oracle/verify

data/runs/                  — Auto-created; one subdir per run
```

### Design tokens (globals.css)

All Marbled Ink tokens are CSS custom properties on `:root` and also registered into Tailwind v4's `@theme inline` block so components can use both `var(--ink-900)` and Tailwind utility classes like `bg-ink-900`:

```
--ink-900 / --ink-800 / --ink-700
--paint-orange / --paint-magenta / --paint-blue / --paint-violet / --paint-cyan
--success / --danger / --warn
--fg / --fg-muted / --border / --glass-bg
--gradient-cta / --wave-mesh
--font-display / --font-body / --font-mono
--radius-card / --radius-pill / --ease-spring
```

### How to run

```bash
# Development (no API keys required)
npm run dev

# Production build
npm run build
npm run start
```

**Required:** No environment variables required for the demo path.

**Optional env vars:**
- `AGENT_TIMEOUT_MS` — per-agent hard timeout (default: `90000`)
- `REDIS_URL` — if set, could be wired to a real Redis client (currently falls back to in-memory)
- `BROWSERBASE_API_KEY` — if set, agents could use real web retrieval (currently seeded corpus)
- `ANTHROPIC_API_KEY` — if set, oracle semantic judge could call Claude (currently deterministic stub)

### What was verified (live smoke test — 3 runs)

1. `GET /api/health` → `{status: "healthy", store: "in-memory", redis: "fallback"}` ✓
2. `GET /api/bounties` → 6 seeded bounties returned ✓
3. `GET /api/leaderboard` → 3 agents sorted by reputation (charlie 780, alpha 420, beta 310) ✓
4. `GET /api/stats` → platform stats object ✓
5. `POST /api/bounties` with hero description → requirements compiled correctly ✓
6. `POST /api/runs {bountyId: "bounty-hero-001"}` → run started, completed in ~25s ✓
7. Run events: 2 FAIL verdicts + 1 PASS verdict (deterministic across 3 consecutive runs) ✓
8. Agent Alpha FAIL: 3 duplicates (Stripe, Plaid, Brex) + 3 low-revenue companies ✓
9. Agent Beta FAIL: 5 invalid emails (vp@, not-an-email, fake domain, double-@, missing @) ✓
10. Agent Charlie PASS: 20/20, 0 duplicates, all emails valid, overall=100 ✓
11. Escrow released to `agent-charlie` at `status: "released"` ✓
12. Agent Charlie reputation: 780 → 830 (+50) after settlement ✓
13. Disk artifacts written: `requirements.json`, `submission-agent-*.json`, `oracle-scores.json` ✓
14. `GET /api/runs/:runId/events?after=<seq>` polling fallback returns correct events ✓
15. `npm run build` → clean build, 15 API routes registered ✓
16. TypeScript: 0 errors (`npx tsc --noEmit`) ✓

---

## Cross-Cutting Concerns

### Security
- All routes run server-side only (Next.js App Router API handlers)
- No user auth in demo path (explicitly out of scope)
- In-memory store is process-scoped (single process, no XSS/CSRF surface)

### Observability
- `console.error` on all caught exceptions with file/function prefix
- All pipeline stages emit timestamped RunEvents (full audit trail)
- `/api/health` exposes store/redis/browserbase status

### Performance / Reliability
- Hero loop: ~25s wall clock (well under 240s ceiling)
- Heartbeat every 8s during compete + verify stages (no dead air > 10s)
- Auto-retry once per agent; second failure → graceful FAILED_RETRIEVAL status
- Hard timeout via `Promise.race` — no agent can hang the pipeline
- SSE stream drains past events on reconnect via `Last-Event-ID`
- Polling fallback at `/events?after=<seq>` for EventSource-unsupported clients
- Settlement idempotent — calling twice returns same Escrow without side effects

### Scalability notes (post-hackathon)
- Replace `InMemoryStore` with Redis client (stub already in place via env var check)
- Wire real Browserbase retrieval behind `source: "browserbase"` branch in agents
- Wire Claude API for oracle semantic judge when `ANTHROPIC_API_KEY` present
- Add request deduplication middleware for `POST /api/runs` at scale

---

## Open Questions / Risks

| Item | Risk | Mitigation |
|------|------|-----------|
| In-memory store is process-local | Vercel serverless = new process per request → state lost between calls | Self-host or use Redis; not an issue for single-process `npm run dev` demo |
| `POST /api/runs` idempotency | Only guards against concurrent runs for same bountyId in same process | Sufficient for demo; add Redis lock for production |
| SSE on Vercel Edge | Edge runtime doesn't support Node.js APIs | `runtime = "nodejs"` set in stream route; run on Node.js deployment target |
| Oracle semantic stub | LLM-judge is deterministic (not real Claude call) | Acceptable for demo; swap in Claude API call when key available |
