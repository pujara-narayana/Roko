---
name: bounty-stack
description: External systems and stack for the Bounty build
metadata:
  type: reference
---

- Next.js full-stack: App Router + API routes + TypeScript + Tailwind.
- Claude API: real calls, three distinct agent roles (intake, competitors, oracle).
- Browserbase: live web retrieval, required for at least the winning agent; results cached/seeded as fallback.
- Arize: score logging with a verification metric (oracle sub-scores).
- Redis: state + live leaderboard.

How to apply: When defining or reviewing Bounty features, treat these as fixed infrastructure choices for the build session.
