---
name: feature-user-created-agents
description: Market validation findings for Bounty's User-Created Agents feature (two-sided marketplace open supply side), June 2026
metadata:
  type: project
---

Feature: Let users register their own AI agents on Bounty's marketplace via /agents page, registered as Fetch.ai uAgents on Agentverse. Custom-prompt agents (name, emoji, system prompt, Claude model, tool toggles). Competes on bounties via existing pipeline.

**Key market figures (June 2026):**
- Agentverse hosts ~2.7M agents (reached 1M milestone early 2025), 2,500 active monthly builders
- GPT Store: 3M+ GPTs created, only ~159K public/active; creator earnings soft ceiling $100-500/month for most
- AI agents market: $5.83B autonomous agents segment; broader agentic/SDK market $7.84B → $52.62B by 2030 (46% CAGR)
- AI agent marketplaces recognition: 12+ live platforms where agents earn money (May 2026)
- No-code agent builders (MindStudio $20/mo, Voiceflow $60/mo) lowered barrier — non-technical creators can build in hours

**Critical competitive nuance:**
- Agentverse: discovery/registry layer, not a task-execution/verified-outcome layer. No oracle. No escrow.
- GPT Store/Poe: conversation/chat interface; monetizes on per-message or subscription; no task verification.
- MindStudio/Voiceflow: build-and-deploy tools, not competitive marketplaces with verified outcomes.
- Bounty's wedge: verification oracle + auto-settlement is the only differentiator. Every other platform relies on human approval or reputation systems.

**Cold start reality:**
- AI-native vertical marketplaces hitting liquidity in ~67 days with synthetic seed + AI-assisted onboarding (2026 data)
- Apparent thickness can be generated with compute; verified thickness cannot — this is Bounty's structural advantage
- The key cold-start risk is bounty-to-agent ratio: too many agents chasing too few bounties → zero agent earnings → churn

**Trust/spam risk:**
- AI scam activity surged 1,210% in 2025. Agent identity/intent verification is an unsolved infrastructure problem (Visa Trusted Agent Protocol, Skyfire Know Your Agent just emerging in 2026).
- Custom-prompt agents on Bounty face same spam risk as GPT Store (3M created, only 5% active/public)
- Oracle/acceptance-criteria verification is Bounty's primary trust moat — bad agents fail objectively and visibly.

**Supply-side personas identified:**
1. Prompt Engineer / AI Power User — has domain expertise, builds specialized agents for fun/side income
2. Developer / Indie Hacker — wants passive income from AI agent, technical, will use API/SDK
3. Domain SME (researcher, marketer, analyst) — wants to monetize workflow expertise as an agent
4. Hackathon competitor / student — wants reputation/leaderboard visibility, not money

**Validation verdict: MODERATE-STRONG for hackathon demo, MODERATE for production**
- Core thesis is differentiated and timely
- Demo risks: too few bounties for user agents to win = hollow two-sided experience
- Production risks: spam agents, oracle gaming, Fetch.ai dependency complexity

**How to apply:** When planning /agents feature, reference these personas and the cold-start mitigation strategy (pre-seed 5-10 domain-specific bounties for the demo that custom agents can plausibly win).
