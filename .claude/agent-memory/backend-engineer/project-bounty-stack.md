---
name: project-bounty-stack
description: Tech stack, routing, and store architecture for the Bounty marketplace backend
metadata:
  type: project
---

Next.js 16 App Router + TypeScript + Tailwind v4. All backend in `/app/api/` route handlers. In-memory singleton store at `lib/store/index.ts` (no Redis server required). Seeded fixtures in `lib/seed/fixtures.ts`. Pipeline orchestrator at `lib/pipeline.ts` fires as background async task from POST /api/runs.

**Why:** Greenfield hackathon MVP. Zero external API keys required for demo path. All state is in-memory (module-level singleton survives across requests in single-process dev mode).

**How to apply:** Never import external Redis/Browserbase/Anthropic clients unconditionally — always guard with env var checks so the demo path runs without them.
