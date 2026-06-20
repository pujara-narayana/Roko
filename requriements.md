# Bounty — AI-Agent Outcome Marketplace — Hackathon Requirements

*Supersedes the earlier "Agentic Pitch Deck Studio" scope. Models the trybounty.ai product: an open marketplace where you post a job, AI agents compete, an oracle verifies results against your predefined requirements, and you pay only on a verified pass.*

---

## 1. Problem & Solution Summary

People don't want AI tools, they want outcomes — not a lead-gen tool, but 200 verified leads; not an image tool, but a finished headshot. The unsolved problem that makes an outcome marketplace possible isn't generation — it's **verification and settlement**: deciding, without a human babysitter, that the work actually meets the brief and is therefore worth releasing payment for.

Bounty is that trust-and-settlement layer. A poster describes a job and funds an escrow; multiple AI agents compete to deliver it; a **verification oracle** validates every submission against predefined, machine-checkable requirements; escrow releases automatically on pass and returns on fail; and a reputation leaderboard surfaces the best agents over time. **The product being demoed is not "an AI did a task" — it's "the system proved the task was done right before any money moved,"** shown through a live post → compete → verify → settle loop on an objectively verifiable bounty.

---

## 2. Scope

**In-scope hero loop:** one fixed, pre-canned, **objectively verifiable data/research bounty** (e.g., "Build a list of N companies matching criteria" or "Find decision-makers with verified contact info"), run end-to-end through post → compete → verify → settle during the live demo, with no required live audience input.

**In-scope UI (seeded):** a marketplace shell matching the trybounty structure — landing with live-stats tiles, Browse Tasks with category-filtered bounty cards, a Leaderboard of ranked agents, and a Listings/task-template view — pre-populated with realistic seeded data.

**Explicitly out of scope:**
- Real two-sided liquidity and open agent onboarding (agents are pre-seeded).
- Real payments, crypto, escrow custody, KYC, or billing.
- User accounts, multi-tenancy, real authentication (sign-in is a stub).
- The full live task-template catalog with a dynamic pricing engine.
- A trained AI-content-detection model — validity/quality is checked via deterministic rules + an LLM-judge heuristic.
- Live audience-submitted bounties during the demo — the demo path uses a fixed pre-canned bounty for reliability.

---

## 3. Functional Requirements (MoSCoW)

### Must Have
- A marketplace UI shell matching the trybounty structure (landing + live-stats tiles, Browse Tasks with category filters and bounty cards, Leaderboard), seeded with realistic data.
- A **post-a-bounty flow**: the poster describes the job; an intake agent compiles it into structured, checkable acceptance requirements (target count, required fields, criteria); a reward is set and a mock escrow is funded.
- One **hero task type fully functional end-to-end**: a verifiable data/research bounty whose "done" is objectively checkable.
- **Competition:** 2–3 distinct agents attempt the live bounty in parallel and each submit a result.
- A **verification oracle** that validates each submission against the predefined requirements: deterministic checks (count, required-field schema, de-duplication, criteria match) + a semantic LLM-judge for fuzzy criteria + data/contact validity.
- The oracle returns **itemized, human-readable pass/fail reasons** per submission.
- **Settlement:** on pass, escrow releases to the winning agent automatically; on fail, escrow returns. Shown on screen.
- **Agent reputation / leaderboard updates live** from verified completions (Redis-backed).
- The full loop runs end-to-end on the fixed pre-canned hero bounty with no required live user input.
- Intake, competing agents, and the oracle are each distinct Claude roles orchestrated via Claude Code.

### Should Have
- Competing agents fulfill via **real web actions through Browserbase** (find/enrich/verify data on the live web) — at least the winning agent does genuine retrieval, not canned output.
- Competing agents are registered as **Fetch.ai uAgents on Agentverse** and the hero bounty is dispatched to them over the **Chat Protocol**, so the "independent agents compete" story is real cross-agent dispatch rather than internal LangGraph orchestration. (Registered-for-discovery-only is too weak — make at least the hero loop a real uAgents dispatch.)
- Oracle scores logged to **Arize**, so a verification metric (pass-rate, oracle confidence, or before/after a criterion change) is visible after the run.
- The oracle score is broken into **named sub-scores** (criteria-match, completeness, validity) rather than one opaque number.
- One competing submission is **deliberately seeded to fail** a specific criterion on the first pass, so the oracle has something real to reject on stage.
- A **second task type** (e.g., Generate AI Headshot, or Contact Decision-Makers) shown as a quick breadth demo to prove the engine isn't hardcoded to one job.
- A **Listings/task-template view** with productized tasks, per-unit pricing, and volume stats (seeded), matching trybounty.
- A **hard cap** on agent attempt time with a fallback that accepts the best-scoring submission, so the demo can't hang.

### Could Have
- A live animated pipeline status (post → compete → verify → settle) visualizing progress as it runs.
- Reputation influencing agent surfacing (best agents rise over time), matching the trybounty narrative.
- **Bounty exposed as an MCP server** so agents can post/claim bounties programmatically (~30-min add at the end if time allows).
- Real testnet escrow / x402-style agent payment instead of a mock ledger.
- A third fully-wired category filter or task type.

### Won't Have
- Real two-sided liquidity or open agent onboarding — agents are pre-seeded by design.
- Payments/crypto/KYC/billing integration — no demo payoff in 24 hours.
- User accounts / multi-tenancy / real auth — one demo run needs no auth system.
- The full live task-template catalog with a dynamic pricing engine.
- A real AI-detector model — validity is deterministic rules + LLM-judge per scope.
- Live audience-submitted hero bounties — fixed pre-canned brief for reliability.

---

## 4. Non-Functional Requirements
- The hero loop (post → compete → verify → settle) must reliably complete within a fixed ceiling (target under 3–4 minutes wall clock) so the audience isn't watching dead air. Real fulfillment can take "1 hour" in production; the demo path is bounded.
- Each agent stage and the oracle must emit a visible "in progress" status so latency reads as active work, not a stall.
- The hero loop must complete cleanly across at least 3 consecutive rehearsal runs before the demo slot.
- Any single failed agent / LLM / Browserbase call must auto-retry at least once.
- All intermediate artifacts (requirements JSON, each submission, oracle scores and reasons) must be persisted to disk, with a recorded backup video as fallback for a failed live run.
- Browserbase fulfillment results for the demo path must be cached/seeded so a flaky third-party site cannot end the demo.
- Redis and Arize writes must be asynchronous/non-blocking so they never add user-visible latency.

---

## 5. Demo Success Criteria
For judges to register the intended "wow," the live demo must show:
- The full **post → compete → verify → settle** loop completing live within the slot, with zero manual edits by the presenter.
- At least one competing submission **visibly failing the oracle**, with its specific, readable rejection reasons on screen (e.g., "14 of 20 companies matched the revenue criterion; 3 duplicates; 2 emails failed validation").
- A passing submission triggering **automatic escrow release** on screen.
- The **leaderboard/reputation visibly updating** from the verified completion.
- A quantified verification metric (via Arize) shown after the run.
- Feedback legible enough that judges can state, unprompted, what the oracle checked and why one agent won.

---

## 6. Sponsor Integration Map

**Committed tracks (pick 2) — the two most load-bearing and visible in this product:**
- **Redis** — leaderboard (sorted sets), escrow ledger state, agent reputation, submission cache, bounty/agent matching. Most natural integration; best-defined prize.
- **Browserbase** — competing agents act on the live web to fulfill research/lead-gen/outreach bounties. The "agents actually went and did the work" moment.

**Host prize:** **Anthropic** — built with Claude Code; intake + competing agents + oracle as Claude roles; "buy outcomes / economic opportunity" framing fits their criteria. Separate from the two sponsor-track slots.

**Strong opportunistic:** **Arize** — the oracle is an eval system; logging scores + showing a before/after is literal "evidence it improved the app" ($1k). Swap in for one of the committed two if you'd rather chase that prize than Browserbase.

**Strong opportunistic — co-host:** **Fetch.ai** — register the competing agents as uAgents on Agentverse and dispatch the hero bounty to them via the Chat Protocol, making the competition real cross-agent dispatch. The single most on-theme sponsor for an agent marketplace, and a **co-host with cash prizes ($1,500 / $1,000 / $500)**. **Confirm with organizers whether co-host tracks count against the 2-sponsor-track cap** — if not, enter it alongside Redis + Browserbase for a free extra shot. If it does count, it's a genuine candidate to displace Browserbase or Arize as a committed track.

**Optional:** Band (frame the competing agents as collaborating via the Band platform); Sentry (trivial SDK add, per-member Switch 2). Don't force these.

---

## 7. Demo Script (target 2–3 min)
1. **Thesis + landing:** "Nobody wants a lead-gen tool. They want 200 verified leads. Bounty lets you buy the outcome and pay only when it's verified." Show the seeded landing + live stats.
2. **Post a bounty:** "Find 20 US fintech companies doing $1M+ revenue, each with a verified VP-of-Engineering email." Intake compiles checkable requirements (count=20, sector=fintech, geo=US, revenue≥$1M, valid-email required). Fund escrow.
3. **Agents compete:** 3 seeded agents attempt it (winner via real Browserbase retrieval). Three candidate result sets appear.
4. **Oracle verifies (money moment):** Agent A ❌ (14/20 matched, 3 duplicates), Agent B ❌ (5 emails fail validation), Agent C ✅ (20/20, criteria met, emails valid) — itemized reasons on screen.
5. **Settlement:** escrow auto-releases to Agent C; the leaderboard updates (C climbs).
6. **Breadth flash (~20s):** the same oracle accepting/rejecting a second bounty type (AI headshot or outreach).
7. **Arize:** show the verification metric / before-after.
8. **Close:** "Bounty is the verification-and-settlement layer that makes outcome-based agent work trustworthy."

---

## 8. Build Allocation (4 builders) & First-2-Hours De-Risk
- **A — Verification Oracle (the moat):** requirements compiler + deterministic + semantic + validity checks + Arize.
- **B — Agent competition + fulfillment:** LangGraph 2–3 agents, Browserbase retrieval for the hero task.
- **C — Frontend/UX:** clone the marketplace shell (landing/browse/leaderboard/listings), the live compete→verify→settle view, animations, pitch deck.
- **D — Redis / state / escrow / seed data / integration / deploy:** leaderboard, reputation, mock escrow, seed agents + bounties + stats, glue, deployment.

**Hour 0–2 de-risk:** Browserbase + Arize hello-world working; seed one deliberately-failing submission; lock the requirements-JSON schema all four workstreams agree on. **Integration freeze at hour 18** — after that, demo-path fixes only.

**Brand note:** match trybounty's structure and flow, but write your own copy and visual identity — don't reproduce their text/branding verbatim.