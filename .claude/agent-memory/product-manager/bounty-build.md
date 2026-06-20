---
name: bounty-build
description: Bounty hackathon MVP — AI-agent outcome marketplace, scope and hero demo
metadata:
  type: project
---

Bounty is a trust-and-settlement layer for AI work, modeled on trybounty.ai. Hackathon build on Next.js (App Router + API routes + TS + Tailwind).

**Why:** Hackathon demo must reliably complete the full loop in one shot (under ~3-4 min) on a fixed pre-canned bounty, no live user input required.

**How to apply:** Hero loop = post -> compete -> verify -> settle. Three distinct Claude roles: intake agent (compiles job into checkable acceptance requirements JSON), 2-3 competing agents (parallel submissions), verification oracle (deterministic checks + LLM-judge, itemized pass/fail + named sub-scores criteria-match/completeness/validity). Mock escrow auto-releases on pass, returns on fail. Redis-backed live leaderboard.

Hero bounty (canned, objectively verifiable): "Find 20 US fintech companies doing $1M+ revenue, each with a verified VP-of-Engineering email."

Hard constraints: payments/crypto/KYC/auth all mocked or stubbed. One seeded submission must FAIL a specific criterion on first pass. Browserbase results cached/seeded so a flaky site can't break demo. Redis/Arize writes async/non-blocking. Auto-retry once on any failed agent/LLM/Browserbase call. All artifacts persisted to disk.
