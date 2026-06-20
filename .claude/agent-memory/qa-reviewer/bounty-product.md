---
name: bounty-product
description: Bounty AI-Agent Outcome Marketplace — hackathon demo product overview
metadata:
  type: project
---

Bounty = AI-Agent Outcome Marketplace. Hackathon one-shot live demo (<3-4 min).
Stack: Next.js App Router + TS + Tailwind; Claude API (intake+oracle=opus, competitors=haiku); Browserbase; Arize; Redis w/ in-memory fallback.

Hero loop: Poster funds mock escrow -> 2-3 Claude agents compete on fixed bounty -> verification oracle grades (deterministic + LLM-judge) returning 3 sub-scores + itemized pass/fail -> escrow auto-releases to winner on pass / returns on fail -> leaderboard updates. One submission seeded to FAIL.

**Why:** Demo must run bug-free in one shot, visible "in progress" at every stage.
**How to apply:** Prioritize live-demo-breaking and viewer-confusing issues. Key risk areas: SSE<->polling handoff + seq dedupe, reducer "all agents done" inference, settlement idempotency, scoring division-by-zero, optimistic escrow rollback.

Scoring gates: PASS iff completeness>=95 AND criteriaMatch>=90 AND validity>=90 AND overall>=90 AND duplicates==0. No-pass path = best-scoring fallback winner but escrow RETURNS (not released).
