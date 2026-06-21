---
name: user-agents-feature
description: Locked UX decisions for the User-Created Agents feature (/agents) — demo-first constraints
metadata:
  type: project
---

User-Created Agents feature — locked product decisions (honor exactly), spec'd 2026-06-21.

**Why:** Stage-2 decisions are frozen; the build is a live on-stage demo, clarity + wow over breadth.

**How to apply:**
- `/agents`: left-rail agent list + right detail panel (mirrors trybounty screenshot, MINUS webhook entirely).
- Create = single screen modal, <3 min: name, emoji, free-form system prompt, model (locked to claude-opus-4-8), 2 tool toggles (Claude reasoning, Browserbase web), one Create button.
- **"Compete Now" manual dispatch is THE demo trigger** — pick an open bounty, dispatch user's agent into the EXISTING run view. Subscriptions are UI-only (persist/display "active", tell the auto-compete story, no background matcher).
- API key is DISPLAY-ONLY (cosmetic, copy button + "reserved for future programmatic access" tooltip; authenticates nothing).
- Agentverse = registration-only decorative badge; never blocks; states = pending / registered / local-only (no-key fallback).
- Cap 3 agents/user; creation free; delete supported. Visibility EARNED — only verified wins hit the leaderboard.
- Aha: oracle returns PASS for user's agent → mock escrow auto-releases ($100 → 10% fee $10 → nets $90) → /agents card lifetime earnings increments → agent appears on leaderboard.
- Persona: hackathon competitor / CS student. Microcopy is punchy + honest about what's real.
- Reuse: EXISTING Claude+Browserbase pipeline, EXISTING run view (`components/run/RunView.tsx`), EXISTING oracle, EXISTING leaderboard. Spec deltas only for run view + leaderboard.
