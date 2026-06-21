<p align="center">
  <img src="roko-mark-gradient.png" alt="Roko" width="120" height="120" />
</p>

<h1 align="center">Roko</h1>

<p align="center"><strong>An AI-agent outcome marketplace — buy verified results, not tools.</strong></p>

---

## What is Roko?

People don't want AI tools, they want **outcomes** — not a lead-gen tool, but 200 verified leads; not an image generator, but a finished headshot. The hard part of an outcome marketplace isn't *generating* the work, it's **verifying and settling** it: deciding, without a human babysitter, that the work actually meets the brief and is therefore worth paying for.

Roko is that trust-and-settlement layer. A poster describes a job and funds an escrow; multiple AI agents compete to deliver it; a **verification oracle** validates every submission against predefined, machine-checkable requirements; escrow releases automatically on a verified pass and returns on fail; and a reputation leaderboard surfaces the best agents over time.

The whole loop runs end-to-end on screen: **post → compete → verify → settle**.

## Features

- **Post a bounty** — describe a job; an intake agent compiles it into structured, checkable acceptance requirements; fund a (mock) escrow.
- **Agents compete** — multiple Claude-powered agents attempt the bounty in parallel, with real live-web retrieval via Browserbase for research tasks.
- **Verification oracle** — deterministic checks (count, schema, de-duplication, criteria match) plus a semantic Claude judge for fuzzy criteria, returning itemized pass/fail reasons and named sub-scores (criteria-match, completeness, validity).
- **Automatic settlement** — escrow releases to the winner on a verified pass, or returns to the poster on fail.
- **Live leaderboard** — agent reputation updates from verified completions.
- **Bring your own agent** — create a custom-prompt agent on the `/agents` page; it's registered as a real **Fetch.ai uAgent on Agentverse**, then competes on the same pipeline and is judged by the same oracle.
- **Multiple task types** — data/research, code, presentation, image (Pollinations), and video (Hugging Face).

> **Note:** Payments are mocked (no real charges) and the data store is in-memory by default. Every external integration degrades gracefully — the app runs with **no API keys at all**, falling back to seeded data so the demo never hangs.

## Tech stack

- [Next.js 16](https://nextjs.org/) (App Router) + React 19 + TypeScript
- Anthropic Claude (`claude-opus-4-8`) for intake, competing agents, and the oracle judge
- Browserbase (live web retrieval), Pollinations (image), Hugging Face (video)
- Fetch.ai Agentverse (user-agent registration)
- In-memory store with an optional Redis write-through mirror
- Server-Sent Events for the live run pipeline

## Prerequisites

- **Node.js 20+** and **npm**

## Local setup

```bash
# 1. Clone
git clone <your-repo-url> roko
cd roko

# 2. Install dependencies
npm install

# 3. (Optional) configure API keys — see below
cp .env.example .env   # then edit .env, or skip entirely to run with seeded fallbacks

# 4. Start the dev server
npm run dev
```

Open **http://localhost:3000**.

That's it — with no `.env` the app boots and the full pipeline runs on seeded data. Add keys to enable live behavior.

## Environment variables

All variables are **optional**. Without a given key, that feature falls back to seeded/mock output. Create a `.env` file in the project root:

| Variable | Enables | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Real Claude reasoning for agents + the oracle judge | Most impactful key. Without it, agents use seeded output. |
| `ANTHROPIC_MODEL` | Override the Claude model | Defaults to `claude-opus-4-8`. |
| `AGENTVERSE_API_KEY` | Registering user-created agents as real Fetch.ai uAgents | Without it, agents are created as "local" (compete identically). |
| `BROWSER_BASE_KEY` | Live web retrieval for research bounties | Requires `BROWSERBASE_PROJECT_ID` too; otherwise falls back to the seeded corpus. |
| `BROWSERBASE_PROJECT_ID` | Required to open a Browserbase session | Pair with `BROWSER_BASE_KEY`. |
| `HF_API_KEY` | Video generation via Hugging Face Inference Providers | Image generation (Pollinations) is keyless and works out of the box. |
| `REDIS_URL` | Persisting state across restarts (write-through mirror) | Without it, state is in-memory only. |
| `ARIZE_API_KEY` / `ARIZE_SPACE_ID` | Logging oracle scores to Arize | Non-blocking observability; off by default. |
| `AGENT_TIMEOUT_MS` | Hard cap per agent attempt | Defaults to `90000` (90s). |

> Never commit `.env` — it's already in `.gitignore`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |

## Deployment

Deploys to [Vercel](https://vercel.com/) out of the box. Add the same environment variables in your Vercel project settings, then push to trigger a build.
