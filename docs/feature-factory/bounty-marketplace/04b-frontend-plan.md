# Frontend Plan — Bounty: AI-Agent Outcome Marketplace

> Note: the frontend-engineer agent implemented all code below and the build was
> verified, but the agent hit a session limit before writing this log. This artifact
> was reconstructed by the orchestrator from the actual source on disk and a runtime
> smoke test of the full hero loop. Code is real and `npm run build` passes.

## Component tree

```
app/layout.tsx                      root layout — fonts, NavBar, Footer, globals
├─ app/page.tsx                     Landing
│   ├─ components/WaveBackground    animated marbled-ink mesh (reduced-motion gated)
│   ├─ components/landing/StatsTiles   live-stats tiles (GET /api/stats, count-up)
│   └─ components/landing/FeaturedStrip
├─ app/browse/page.tsx              Browse Tasks
│   ├─ filter chip rail (client-side)
│   └─ components/BountyCard (grid)
├─ app/bounty/[id]/page.tsx         Bounty Detail → mounts RunView (centerpiece)
│   └─ components/run/RunView       ← THE CENTERPIECE
│       ├─ RequirementsBlock        requirements JSON (mono/tabular)
│       ├─ StageIndicator           4-pip Post·Compete·Verify·Settle
│       ├─ AgentCard ×3             "Working" pulse + live log lines
│       ├─ VerdictCard ×3           sub-scores (fixed order) + itemized reasons
│       └─ SettlementPanel          escrow release + leaderboard delta
├─ app/run/[id]/page.tsx            alias route into the run experience
├─ app/leaderboard/page.tsx         podium + ranked table
└─ app/listings/page.tsx           templates grid + AuthStubModal
```

Shared UI primitives in `components/ui.tsx` (Card, CategoryBadge, AlertBar, EmptyCard, skeletons). NavBar/Footer/AuthStubModal are global.

## State management

- **`lib/client/useRunStream.ts`** — the heart of the centerpiece. A `useReducer`
  pipeline that: POSTs `/api/runs`, opens `EventSource(streamUrl)`, parses each
  `RunEvent`, **dedupes by monotonic `seq`**, and folds `(stage,status)` pairs into a
  `PipelineState` (stages, per-agent cards, verdicts in arrival order, settlement,
  leaderboard, connection state). On `EventSource` error it **falls back to polling**
  `GET /api/runs/:id/events?after=<lastSeq>` every 1.2s; stops on `done`. Auto-reconnect
  via EventSource Last-Event-ID; shows reconnecting/polling/error AlertBars.
- **`useElapsed`** — run timer; **`useCountUp`** — stats animation.
- Other screens use local `useState` + `useEffect` fetches against `lib/client/api.ts`
  (typed wrappers over the REST envelope `{ok,data}`).

## Props / interfaces for key components

- `RunView({ bounty, requirements, escrow })` — owns `useRunStream(bounty.bountyId)`;
  auto-starts on mount unless `prefers-reduced-motion` (then manual "Start Demo Run").
- `AgentCard({ agent: AgentCardState, name, index })` — status queued/working/submitted/failed, capped log lines, progress step.
- `VerdictCard({ verdict: VerdictState, agentName, index, escrowReleased })` — renders
  `subScores` ALWAYS in order **criteriaMatch · completeness · validity**, overall,
  summary, and itemized `reasons[]`; PASS winner shows escrow-release confirmation.
- `SettlementPanel({ settlement, winnerName, leaderboard, complete })`.
- `StageIndicator({ stages: Record<StageKey, StageState> })`.

## Data flow (API contracts consumed)

| Screen | Endpoints |
|--------|-----------|
| Landing | `GET /api/stats` |
| Browse | `GET /api/bounties` |
| Bounty/Run | `POST /api/runs`, `GET /api/runs/:id/stream` (SSE), `GET /api/runs/:id/events?after=seq` (poll), `GET /api/bounties/:id` |
| Leaderboard | `GET /api/leaderboard` |
| Listings | `GET /api/listings` |

## Implementation log

- **Files created:** `app/layout.tsx`, `app/page.tsx`, `app/browse/page.tsx`,
  `app/bounty/[id]/page.tsx`, `app/run/[id]/page.tsx`, `app/leaderboard/page.tsx`,
  `app/listings/page.tsx`, `app/globals.css`; `components/` (NavBar, Footer,
  WaveBackground, BountyCard, AuthStubModal, ui.tsx, landing/StatsTiles,
  landing/FeaturedStrip, run/RunView, run/AgentCard, run/VerdictCard,
  run/SettlementPanel, run/StageIndicator, run/RequirementsBlock);
  `lib/client/` (useRunStream, useElapsed, useCountUp, api, constants, format).
- **States handled:** empty (EmptyCard / empty-category ghost), loading (skeleton
  shimmer + count-up), error (AlertBar tones: danger/blue), success (full pipeline
  through settlement). Run view additionally handles: not-started, reconnecting,
  polling-fallback, connection-error, and complete.
- **Design:** Marbled-Ink tokens via CSS variables in `globals.css`; all
  data/money/scores/timers use mono tabular-nums; wave + auto-play gated behind
  `prefers-reduced-motion`.
- **Verification:** `npm run build` passes clean (14 API routes + 7 pages, 0 TS
  errors). Runtime smoke test of the full loop: 36 ordered events, Alpha FAIL /
  Beta FAIL / Charlie PASS → escrow released $500 → leaderboard updated.
