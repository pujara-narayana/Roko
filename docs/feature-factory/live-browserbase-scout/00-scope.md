# Scope — Live Browserbase Retrieval for Scout (hero specialist)

> **STATUS: IMPLEMENTED & VERIFIED (2026-06-21).** Cold run drove a real browser to
> 20 fintech sites (16 reached), cached the corpus, and the binding oracle passed
> Scout (validity 98 → escrow released). Cache replay run = ~6s. Prod build green.
> Code: `lib/providers/browserbase.ts` (`retrieveCompanies`), `lib/live-corpus.ts`,
> `lib/agents/index.ts` (specialist branch). Env: `BROWSERBASE_PROJECT_ID` set.


## Goal
Make the hero-bounty specialist agent (**Scout**) perform *genuine* live web retrieval
through Browserbase — so the "the agent actually went and did the work" claim is true —
while keeping a seeded fallback so the demo can never hang or flip.

## Current state (what's fake today)
- `lib/providers/browserbase.ts` opens **and immediately closes** a real session
  (`createSession` → `closeSession`) but does **no automation**: no CDP connect, no
  navigation, no DOM extraction.
- `lib/agents/index.ts` `fulfillResearch` (specialist branch, lines 75-92) returns
  `getPerfectCorpus()` — the 20 hard-coded `GOOD_COMPANIES` — whether or not a session
  opened. The progress lines ("Cross-referencing MX records…") are string literals.
- Blocker: `BROWSERBASE_PROJECT_ID` is unset, so `createSession` returns null and we
  never even open a session. `BROWSER_BASE_KEY` **is** present.

## What "live" honestly means here
Reliably scraping 20 US fintech companies **each with a verified VP-of-Engineering
email** off the open web in <45s is not realistic — verified exec emails aren't
scrapable, and that's exactly why the original build seeded it. So "live" must be
scoped to what a browser can truthfully retrieve, with synthesis + fallback for the
rest. Three tiers:

| Tier | What Scout really does | Honesty of claim | Demo risk | Effort |
|------|------------------------|------------------|-----------|--------|
| **T1 — Proof-of-life** | Connect via CDP, navigate to each company's real website, confirm it resolves + grab a real signal (page title / careers page exists). Records still seeded, but *validated against the live site*. | "Scout drove a live browser to verify each company on the web." | Low | ~2-3 h |
| **T2 — Hybrid retrieval** *(recommended)* | Browser navigates a real source (a fintech list / each company's site), extracts **real** company name + website + a revenue/size signal; Claude normalizes to `CompanyRecord`; VP-Eng email is **pattern-derived** (`vp-eng@domain`) and passed through the same format/MX-style check. | "Scout retrieved the companies live and enriched them; emails are inferred and validated." | Medium | ~4-6 h |
| **T3 — Fully live** | Real discovery of 20 firms + real contact enrichment via a data API. | Fully real. | High / unreliable | out of scope |

## Recommended: **T2**, gated behind cache + fallback
Real enough to be a legitimate Browserbase + "did the work" story, without betting the
demo on flaky pages.

## Implementation outline (T2)
**Prereqs**
- Set `BROWSERBASE_PROJECT_ID` in `.env` (unblocks sessions immediately).
- Add dep: `playwright-core` (connect to the session's `connectUrl` via
  `chromium.connectOverCDP`). Optional: `@browserbasehq/sdk` for session mgmt.

**`lib/providers/browserbase.ts`** — add a real retrieval function:
- `retrieveCompanies(targets: {name,website}[], opts): Promise<Partial<CompanyRecord>[] | null>`
  - connect over CDP to the session, for each target `page.goto(website)`, extract
    real signals (final URL resolves, `<title>`, presence of a careers/about page),
    return what was actually observed; null on any failure.
  - Hard per-call timeout; concurrency cap (2-3 pages); never throw.

**`lib/agents/index.ts`** — rework the specialist branch of `fulfillResearch`:
1. Open session (existing). If null → seeded fallback (unchanged).
2. `retrieveCompanies(...)` against a seed *target list* (real company names+sites).
3. Claude synthesizes/normalizes the observed signals into 20 `CompanyRecord`s,
   filling `vpEngEmail` with a derived pattern (`vp-eng@<domain>`); revenue from the
   observed signal or seeded estimate.
4. Mark `source: 'browserbase'`, `engine: 'browserbase'` on success;
   `source: 'seeded_cache'` on any miss.
5. Wrap in the existing timeout + single-retry + seeded-fallback machinery.

**Mapping to `CompanyRecord`**: `{ id, name, sector:'fintech', geo:'US', revenue,
vpEngEmail, vpEngName?, website }`. Same shape the oracle already consumes — no type
or oracle changes needed.

## The critical interaction: live data × the new binding oracle
The oracle is now a **binding LLM judge** (completeness/validity gate the verdict). If
Scout's live data varies run-to-run, the oracle could score it differently and **fail
the demo** (we already saw synthetic emails tank validity). Mitigations, in order:
1. **Cache the first successful live retrieval to disk** and replay it for the demo
   path (requirements §4 already mandates cached Browserbase results). Live call only
   on a cold cache / explicit "go live" toggle.
2. Keep the seeded `GOOD_COMPANIES` as the guaranteed fallback corpus.
3. Rehearse the live path; if a record's derived email can't pass validation, the
   audit-anchored rubric will dock validity — so prefer domains whose pattern emails
   are well-formed.

**Recommended demo posture:** run live **once in rehearsal**, cache it, and present
from cache — truthful ("this was retrieved live"), zero stage risk.

## Out of scope
- Real verified exec-email sourcing (T3).
- Changing the challengers (Forge/Deck stay seeded by design).
- Fetch.ai uAgents dispatch (separate upgrade).

## Locked decisions
1. **Tier: T2 — Hybrid retrieval.** Browser extracts real company name/site/size
   signal; Claude normalizes to `CompanyRecord`; VP-Eng email pattern-derived +
   validated.
2. **Demo posture: live once, then cache.** Run live in rehearsal, persist the result
   to disk, present from cache on stage. Live call only on a cold cache or an explicit
   "go live" toggle. Seeded `GOOD_COMPANIES` remains the guaranteed fallback.

## Build prerequisites (needed before live verification)
- **User-provided:** `BROWSERBASE_PROJECT_ID` in `.env` (the only blocker to opening a
  session; `BROWSER_BASE_KEY` already present). Without it the code still ships but can
  only be exercised on the seeded-fallback path.
- **Dependency:** add `playwright-core` for CDP connect.

## Build steps (T2)
1. Add `playwright-core`; add `retrieveCompanies()` to `browserbase.ts` (CDP connect →
   navigate target list → extract → null on fail, hard timeout, concurrency cap).
2. Add a disk cache helper (`artifacts/hero-live-corpus.json`): read-through on the
   specialist path; write on first successful live retrieval.
3. Rework specialist branch of `fulfillResearch`: cache → else live retrieve → Claude
   normalize → map to records → seeded fallback. Tag `source` accurately.
4. Rehearse live, confirm the oracle still passes Scout from the cached corpus
   (binding-judge stability), then present from cache.
