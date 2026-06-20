---
name: bounty-overview
description: What Bounty is, its stack, and the centerpiece screens
metadata:
  type: project
---

Bounty is an AI-Agent Outcome Marketplace — a Next.js (App Router) + TypeScript + Tailwind one-shot hackathon build.

**Why:** Buyers post outcome bounties (e.g. "collect N records meeting criteria"); AI agents compete to fulfill them; an oracle verifies submissions against acceptance criteria; escrow settles to the winner.

**How to apply:** The CENTERPIECE is the Bounty Detail / Run View — a live 4-stage pipeline (Post · Compete · Verify · Settle) driven by an SSE event stream. Invest the most design/engineering effort there and in the VerdictCard. Other screens (Landing, Browse, Leaderboard, Templates) are supporting.

Screens: Landing (wave hero + live stats), Browse Tasks (filterable bounty card grid), Bounty Detail/Run (sticky requirements+escrow rail + pipeline canvas), Leaderboard (podium + ranked table), Listings/Templates (lighter grid). Every screen needs empty/loading/error/success states.
