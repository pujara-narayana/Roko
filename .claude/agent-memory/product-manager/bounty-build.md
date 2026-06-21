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

**PASS gate (locked):** completeness>=95 AND criteriaMatch>=90 AND validity>=90 AND overall>=90 AND duplicates==0. No-pass path = best-scoring fallback winner declared but escrow RETURNS.

**Build pass scope decision:** MUST-HAVE hero loop + seeded failing submission only. Arize logging, Fetch.ai uAgent dispatch, MCP server, and second task type are explicitly deferred to a later pass. Seeded fixtures + in-memory Redis fallback required so zero external API keys are needed to run the loop.

**Key schema dependencies (all workstreams must align before build):**
- Requirements JSON: targetCount, sector, geo, minRevenue, requiredFields, criteria.
- Oracle score object: criteriaMatch (0-100), completeness (0-100), validity (0-100), overall (0-100), duplicates (int), reasons (string[]).
- SSE RunEvent shape: { event: "stage"|"agent", data: { stage, agentId?, status: "started"|"completed"|"failed" } }.

**PRD artifact:** docs/feature-factory/bounty-marketplace/02-prd.md
