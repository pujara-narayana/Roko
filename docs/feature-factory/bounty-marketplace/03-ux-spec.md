# UX Spec — Bounty: AI-Agent Outcome Marketplace

**Visual identity:** Marbled Ink (locked — see agent-memory). All color references below use the locked tokens. Do not substitute Tailwind defaults.

---

## User Flows

### Flow A — Hero Demo Loop (primary path, no user input required after bounty is posted)

**Goal:** The audience watches post → compete → verify → settle complete automatically, with one agent visibly failing the oracle and one passing, escrow settling on screen.

**Entry Point:** Landing page → "Run the Demo" CTA opens the pre-canned bounty's Run view directly.

```
1. Landing                     User sees live-stats tiles + hero CTA
   → clicks "Watch It Run"     → navigates to Bounty Detail / Run view (pre-canned bounty)
   
2. Run view — POST stage        System shows structured requirements JSON panel
   [0–10s]                      Intake agent compiling brief → visible "Compiling requirements…" pulse
   → stage completes            Requirements lock; escrow funded badge appears
   
3. Run view — COMPETE stage     3 agent cards appear sequentially (40ms stagger)
   [10s–2min]                   Each card shows real-time status: queued → working → submitted
   → Agent A submits early      Card flips to "Submitted" (14 results visible in preview)
   → Agent B submits            Card flips to "Submitted"
   → Agent C submits            Card flips to "Submitted"
   
4. Run view — VERIFY stage      Oracle banner activates; each submission processed in order
   [2min–3min]                  Per-submission: score counter animates, sub-scores reveal
   → Agent A verdict            VerdictCard: FAIL — itemized reasons shown
   → Agent B verdict            VerdictCard: FAIL — itemized reasons shown
   → Agent C verdict            VerdictCard: PASS — sub-scores all green
   
5. Run view — SETTLE stage      Escrow release animation plays (funds flow icon)
   [3min–3min20s]               "Settled to Agent C" confirmed; leaderboard rank badge updates
   
6. Post-settle                  "View Leaderboard" CTA appears; breadth flash available
```

**Decision branches (demo path — seeded fixtures):**
- If SSE connection drops: client reconnects silently and replays missed events from last event ID.
- If fixture data missing: show skeleton loaders, log error to console, never blank-screen.

**Success state:** All 4 stage indicators lit, VerdictCard PASS visible, escrow settled badge shown, leaderboard rank delta shown.

---

### Flow B — Browse & Discover

**Goal:** A visitor browses available bounties, filters by category, opens a detail view.

```
1. Landing → "Browse Tasks" nav  → Browse Tasks page loads (seeded grid)
2. Browse Tasks                  User scans bounty cards (F-pattern)
   → clicks a category chip      Grid filters client-side; count badge updates
   → clicks a bounty card        → Bounty Detail page (static detail, not live run)
3. Bounty Detail (static)        User reads requirements, escrow amount, competing agents list
   → "Back" breadcrumb           → returns to Browse Tasks (filter state preserved)
```

---

### Flow C — Leaderboard Exploration

```
1. Post-settle or nav            → Leaderboard page
2. Leaderboard                   User scans podium (top 3 by score) then ranked table
   → clicks agent row            Inline expand: recent completions, sub-score breakdown
   → collapses row               Table contracts
```

---

### Flow D — Listings / Templates Browse

```
1. Nav → "Listings"              → Listings / Templates page (seeded grid)
2. Page loads                    User scans productized task cards (category + per-unit price)
   → clicks a task card          Slide-over panel: task description, volume stats, "Post Bounty" CTA
   → CTA (stub)                  Shows modal: "Auth required — demo mode" (stub; no real auth)
```

---

## Information Architecture

```
/ (Landing)
├── /browse              Browse Tasks
│   └── /bounty/:id      Bounty Detail (static — not live run)
├── /run/:id             Bounty Run view (live pipeline — hero demo)
├── /leaderboard         Leaderboard
└── /listings            Listings / Templates
```

**Navigation bar (persistent):** Logo · Browse · Leaderboard · Listings · [Run Demo] primary CTA (right-anchored). No auth UI except a ghost "Sign in" link that triggers the stub modal.

---

## Screens / Layouts

---

### Screen 1 — Landing

**Purpose:** Establish the thesis, show the product is alive and active, direct the audience to the hero demo.

**Primary user goal:** Understand what Bounty is and enter the hero demo in one click.

**Layout — desktop (12-col, 8px base):**

```
[ NAV BAR — full width ]
[ HERO SECTION — full viewport height ]
  Col 1–12: Marbled-ink animated gradient mesh (slow drift, CSS/WebGL)
  Centered column (col 3–10):
    - Eyebrow chip: "AI-Agent Outcome Marketplace"   (Inter 13px, paint-blue, pill bg)
    - H1 display: "Pay for results, not attempts."   (Clash Display 64px, white)
    - Sub-copy: 2-line max, Inter 18px, 70% white
    - Primary CTA: "Watch It Run →"                  (full-radius pill, paint-magenta→paint-orange gradient bg)
    - Ghost CTA: "Browse Tasks"                       (outline pill, white 60%)

[ LIVE STATS TILES — full width, below hero fold ]
  4-column tile strip (glass cards, --ink-800 bg):
    1. Bounties Posted   (count, JetBrains Mono)
    2. Agents Competing  (count)
    3. Avg Verification Time (e.g. "2m 14s")
    4. Total Escrow Settled  (e.g. "$48,200")
  Each tile: large number + label + small sparkline or trend arrow

[ FEATURED BOUNTIES STRIP — horizontal scroll, 3 cards visible ]
  Teaser bounty cards → "Browse all →" link

[ HOW IT WORKS — 3-step flow diagram ]
  Post → Compete → Verify & Settle
  Illustrated with gradient icons

[ FOOTER — minimal: links, "built at hackathon" attribution ]
```

**Key Interactions:**
- Hero CTA navigates to `/run/[hero-bounty-id]` and auto-starts the demo sequence.
- Live stats tiles animate count-up on mount (once, not looping).
- Wave/mesh: `prefers-reduced-motion` disables animation, shows static gradient instead.

**States:**

| State | Behavior |
|-------|----------|
| Loading | Skeleton shimmer on stats tiles (--ink-700 shimmer); wave renders immediately (CSS-only) |
| Stats loaded | Counter animates from 0 to value over 800ms |
| Stats error | Tiles show "--" with a muted error chip; page still functional |
| Empty (no bounties) | Featured strip replaced by single teaser card for the hero bounty |

**Responsive:**
- Desktop (≥1280px): 64px H1, 4-col stats, 3-card strip.
- Tablet (768–1279px): 48px H1, 2-col stats wrap, 2-card strip.
- Mobile (<768px): 36px H1, 2×2 stats grid (stacked), single-col cards, wave behind.

---

### Screen 2 — Browse Tasks

**Purpose:** Scannable grid of available bounties filterable by category; the marketplace shelf.

**Primary user goal:** Find a bounty type matching their need (or understand the scope of the platform).

**Layout — desktop:**

```
[ NAV BAR ]
[ PAGE HEADER — col 1–12 ]
  H2: "Browse Bounties"  (Clash Display 40px)
  Sub: "N open bounties across X categories"

[ FILTER RAIL — sticky below header, full width ]
  Horizontal chip strip (pill, 999px radius):
    [All] [Data & Research] [Content] [Lead Generation] [Outreach] [AI Media]
  Active chip: paint-blue bg + white text
  Inactive chip: --ink-700 bg + 60% white text
  Chip strip scrolls horizontally on mobile (no line-wrap)
  Right of chips: Sort dropdown (Most Recent | Highest Reward | Closing Soon)

[ BOUNTY CARD GRID — col 1–12, 3-col @ desktop ]
  Each BountyCard (glass card, 20px radius, hover: lift + color glow):
    - Category badge (top-left, color-coded pill)
    - Title (Clash Display 20px, white)
    - Short description (Inter 14px, 70% white, 2-line clamp)
    - Meta row: escrow amount (JetBrains Mono, paint-cyan) · competing agents count · time posted
    - Status badge (Open / In Progress / Settled)
    - Hover/focus: "View Details →" overlay CTA
  Grid gap: 24px
  Card min-height: 200px

[ PAGINATION / LOAD MORE — centered below grid ]
  "Load 12 more" button (ghost outline) — client-side from seeded data
```

**Key Interactions:**
- Category chip filters client-side immediately (no network call); grid re-renders with stagger animation (40ms per card).
- Clicking a card navigates to `/bounty/:id` (static detail view) or `/run/:id` for the hero bounty.
- Sort updates sort order client-side.

**States:**

| State | Behavior |
|-------|----------|
| Loading | 9 skeleton cards (shimmer, same dimensions as real cards) |
| Populated | Grid of cards, filter chips enabled |
| Category filter — empty | Single centered message card: "No bounties in this category yet" (ghost card, muted text) |
| Error fetching | Alert bar below filter rail: "Couldn't load bounties — showing cached data" (warn color) |

**Responsive:**
- Desktop: 3-col grid.
- Tablet: 2-col grid.
- Mobile: 1-col grid; filter strip scrolls horizontally.

---

### Screen 3 — Bounty Detail / Run View (CENTERPIECE)

**Purpose:** The live demo surface. Shows the hero bounty's requirements + escrow on a sticky rail; the 4-stage pipeline canvas plays out in real time driven by SSE. VerdictCards render itemized pass/fail per submission. This is what judges watch.

**Primary user goal:** Watch the full post → compete → verify → settle loop complete with visible pass/fail outcomes.

**Layout — desktop (sticky left rail + main canvas):**

```
[ NAV BAR — fixed top ]

[ TWO-COLUMN LAYOUT, below nav ]
  LEFT RAIL — sticky, col 1–4, full viewport height
    ┌─ BOUNTY SUMMARY CARD (glass, --ink-800) ────────────────┐
    │ Category badge · "Hero Bounty"                           │
    │ Title: "Find 20 US Fintech VP-of-Engineering emails"     │
    │ (Clash Display 22px)                                     │
    │                                                          │
    │ REQUIREMENTS BLOCK (--ink-900 bg, 12px radius)          │
    │   Rendered as JSON-adjacent key:value list               │
    │   (JetBrains Mono 13px, --paint-cyan key labels)        │
    │   count: 20                                              │
    │   sector: US Fintech                                     │
    │   revenue: ≥ $1M ARR                                     │
    │   required_field: verified VP-Eng email                  │
    │   dedup: strict                                          │
    │                                                          │
    │ ESCROW BADGE                                             │
    │   "$500 in escrow" (JetBrains Mono, paint-orange)       │
    │   Status: [Funded] → [Released] → [Settled] (animated)  │
    │                                                          │
    │ STAGE INDICATOR STRIP (4 pips)                          │
    │   POST · COMPETE · VERIFY · SETTLE                       │
    │   Active: filled paint-blue pip + label lit              │
    │   Completed: paint-cyan pip + checkmark                  │
    │   Pending: --ink-600 pip                                 │
    └──────────────────────────────────────────────────────────┘
    
    ELAPSED TIMER (below card)
    "2m 14s elapsed" (JetBrains Mono 12px, 60% white)
    Ticks up every second while pipeline running.

  MAIN CANVAS — col 5–12, scrollable
    ┌─ PIPELINE HEADER ──────────────────────────────────────┐
    │ Stage label: "COMPETE" (Clash Display 28px)            │
    │ Stage description (Inter 14px, 70% white)              │
    │ Stage duration badge (e.g. "~90s")                     │
    └────────────────────────────────────────────────────────┘
    
    ─── POST STAGE (collapsed once complete) ───────────────────
    CompletedStageAccordion:
      Header: "POST — Requirements compiled" (paint-cyan checkmark)
      Collapsed by default once stage advances; expandable.
      Expanded content: requirements JSON card (same as left rail)
      
    ─── COMPETE STAGE (active or complete) ─────────────────────
    AgentCompetitionPanel:
      3 AgentCards in a row (or 2+1 stacked on narrower)
      
      AgentCard (glass, 20px radius):
        ┌──────────────────────────────────────────┐
        │ Agent avatar (gradient circle, initials)  │
        │ Agent name (Inter 16px bold)              │
        │ Model label (Inter 12px, 50% white)       │
        │                                           │
        │ STATUS PILL (animates through states):    │
        │   ○ Queued      (--ink-600, neutral)      │
        │   ◉ Working…   (paint-blue pulse)         │
        │   ✓ Submitted  (paint-cyan, solid)        │
        │   ✗ Failed     (fail #FF3D6E, solid)      │
        │                                           │
        │ LIVE LOG (scrolling, max 4 lines):        │
        │   [JetBrains Mono 11px, 50% white]        │
        │   "Querying Browserbase…"                 │
        │   "Found 8 matches…"                      │
        │   "Enriching contacts…"                   │
        │   "Submitting 14 results…"               │
        │                                           │
        │ Result preview (when submitted):          │
        │   "14 results submitted" or "20 results"  │
        └──────────────────────────────────────────┘
        
    ─── VERIFY STAGE (active or complete) ──────────────────────
    OraclePanel:
      Oracle banner: "Verification Oracle — running" (paint-magenta, pulse)
      
      Per submission: VerdictCard (renders as oracle finishes each one)
      
      VerdictCard (glass card, 20px radius):
        ┌──────────────────────────────────────────────────────┐
        │ Header: Agent name + PASS/FAIL badge                 │
        │   FAIL: bg #FF3D6E, "FAIL" label                    │
        │   PASS: bg #21E6C1, "PASS" label                    │
        │                                                      │
        │ SUB-SCORES (always in this order, always shown):     │
        │   criteriaMatch   [progress bar] 70%  (amber warn)  │
        │   completeness    [progress bar] 70%  (amber warn)  │
        │   validity        [progress bar] 80%  (amber warn)  │
        │   (PASS agent: all bars green, 95%+ typical)        │
        │                                                      │
        │ ITEMIZED REASONS (collapsible list, open by default):│
        │   Each reason as a chip-labeled row                  │
        │   FAIL row icons: ✗ red                             │
        │   PASS row icons: ✓ cyan                            │
        │                                                      │
        │ Agent A (seeded FAIL) example reasons:              │
        │   ✗ criteriaMatch — 14/20 matched revenue ≥$1M     │
        │   ✗ completeness  — 3 duplicate entries detected    │
        │   ✗ validity      — 2 email addresses failed MX check│
        │   ✓ format — required fields present                │
        │                                                      │
        │ Agent B (seeded FAIL) example reasons:              │
        │   ✗ validity — 5 emails failed domain validation    │
        │   ✓ criteriaMatch — 20/20 matched                   │
        │   ✓ completeness — no duplicates                    │
        │                                                      │
        │ Agent C (PASS) example reasons:                     │
        │   ✓ criteriaMatch — 20/20 matched revenue ≥$1M     │
        │   ✓ completeness — 20 results, 0 duplicates         │
        │   ✓ validity — all emails passed MX + format check  │
        └──────────────────────────────────────────────────────┘
        
    ─── SETTLE STAGE ────────────────────────────────────────────
    SettlementPanel:
      Escrow release animation: paint-orange → paint-cyan fund-flow
      "Escrow released to Agent C" (Clash Display 24px)
      Transaction ID chip (JetBrains Mono, muted, mock value)
      
      Leaderboard delta card:
        "Agent C: rank +2 → #3" (with sparkline of score history)
      
      Post-settle CTAs:
        Primary: "View Leaderboard"
        Ghost: "Browse More Bounties"
```

**SSE Event → UI State Mapping:**

| SSE Event type | UI change |
|---------------|-----------|
| `stage:start` | Active stage pip lights up; stage label updates |
| `agent:status` | AgentCard status pill transitions; live log appends line |
| `agent:submitted` | AgentCard flips to Submitted; result count shown |
| `oracle:start` | Oracle banner activates with pulse |
| `oracle:verdict` | VerdictCard renders for that agent; sub-scores animate in |
| `settle:complete` | Escrow animation plays; leaderboard delta card appears |
| `run:complete` | Elapsed timer stops; post-settle CTAs fade in |

**"In progress" guarantees — no dead air:**
- Every stage transition emits a `stage:start` event that immediately updates the banner and pip strip. Minimum visible activity: the stage label changes and a pulse animation plays.
- AgentCard live log receives at least one status line every 10 seconds while "Working" (backend must emit heartbeat events).
- Oracle processing each submission emits `oracle:start` with agent name before returning `oracle:verdict`, so there is always a "checking Agent X…" moment visible.

**States:**

| State | Behavior |
|-------|----------|
| Initial load (before run starts) | Left rail populated from seeded data; pipeline canvas shows "POST" stage pending; CTA "Start Demo Run" centered in canvas |
| Stage: POST active | Requirements JSON reveals with stagger; "Compiling…" shimmer on requirements block |
| Stage: COMPETE active | AgentCards enter (stagger 40ms); each pulses as "Working" |
| Stage: VERIFY active | Oracle banner pulses; VerdictCards render one at a time as events arrive |
| Stage: SETTLE active | Settlement panel replaces oracle banner; animation plays |
| Run complete | All pips lit; elapsed timer stops; CTAs visible |
| SSE error / reconnecting | Thin info bar below nav: "Reconnecting…" (paint-blue). Canvas does not blank. |
| SSE fatal disconnect | Error bar: "Connection lost — showing last known state." Cached data remains visible. |
| No data / empty fixture | "No run data available" in canvas center; left rail still shows bounty info |

**Responsive:**
- Desktop (≥1280px): sticky left rail + scrollable main canvas (described above).
- Tablet (768–1279px): left rail collapses to top summary bar (horizontal, 80px tall); pipeline canvas full width below.
- Mobile (<768px): summary bar at top (tap to expand requirements sheet); pipeline stages in vertical accordion; VerdictCards full width.

---

### Screen 4 — Leaderboard

**Purpose:** Show which agents have the best track records; update visibly when the hero demo settles.

**Primary user goal:** See which agents win most often and why (sub-score breakdown).

**Layout — desktop:**

```
[ NAV BAR ]
[ PAGE HEADER ]
  H2: "Agent Leaderboard"  (Clash Display 40px)
  Sub: "Updated live from verified completions"
  Time-since label: "Last update: Xm ago" (JetBrains Mono 12px)

[ PODIUM — col 3–10, centered ]
  3-column podium visualization:
    #2 (left, shorter): agent card at 80% scale
    #1 (center, tallest): agent card at 100% scale + gold paint-orange glow
    #3 (right, shorter): agent card at 70% scale

  PodiumAgentCard:
    Rank badge (#1/#2/#3)
    Agent avatar (gradient circle)
    Agent name (Clash Display 18px)
    Score (JetBrains Mono 28px, paint-cyan)
    Sub-score mini-bars: criteriaMatch · completeness · validity (horizontal)
    Wins count badge

[ RANKED TABLE — col 1–12 ]
  Table (glass bg, full width, alternating --ink-800 / --ink-700 rows):
  Columns: Rank | Agent | Score | Wins | criteriaMatch | completeness | validity | Last Active
  
  Row interactions:
    Hover: row highlight (paint-blue 10% bg)
    Click: inline expand (sub-row slides open, 260ms)
  
  Expanded sub-row:
    Recent 3 completions (bounty title, verdict, date)
    Sub-score history sparklines (3 tiny line charts, JetBrains Mono labels)
    "FAIL reason" most common failure tag if applicable
  
  Header: sticky to top of table section (not fixed to viewport)
  Sortable columns: Score (default desc), Wins, criteriaMatch, completeness, validity

[ LIVE UPDATE BANNER (appears post-settle) ]
  Toast-style bar below nav: "Agent C moved to #3 — just now" (paint-cyan bg, dismissible)
```

**States:**

| State | Behavior |
|-------|----------|
| Loading | Podium: 3 skeleton cards with shimmer. Table: 10 skeleton rows |
| Populated | Render with count-up animation on scores |
| Post-settle update | Row highlighted paint-cyan for 3s; rank badge animates up |
| Empty (no completions) | Podium area: "No verified completions yet — run the demo to populate" |
| Error | Alert bar: "Leaderboard data unavailable — showing cached snapshot" |

**Responsive:**
- Desktop: podium + table as described.
- Tablet: podium 3-col (smaller cards); table horizontally scrollable.
- Mobile: podium stacks vertically (1, 2, 3); table shows Rank/Agent/Score only; tap row to expand.

---

### Screen 5 — Listings / Templates

**Purpose:** Show productized task types with per-unit pricing; the "catalog shelf" for the platform.

**Primary user goal:** Browse the kinds of work Bounty supports and understand pricing.

**Layout — desktop:**

```
[ NAV BAR ]
[ PAGE HEADER ]
  H2: "Task Listings"  (Clash Display 40px)
  Sub: "Productized bounties with verified pricing"

[ FILTER CHIPS — same pattern as Browse Tasks ]
  [All] [Data Research] [Lead Generation] [AI Media] [Outreach]

[ LISTINGS CARD GRID — 3-col @ desktop, glass cards ]
  ListingCard:
    ┌──────────────────────────────────────────────────┐
    │ Category icon (gradient circle, 40px)             │
    │ Task type title (Clash Display 18px)              │
    │ Short description (Inter 14px, 2-line clamp)      │
    │                                                   │
    │ PRICING ROW (JetBrains Mono):                    │
    │   "$X per unit" + "Min order: N"                 │
    │                                                   │
    │ VOLUME STATS (small, 50% white):                 │
    │   "847 completed" · "98% pass rate" · "Avg 4m"  │
    │                                                   │
    │ "Post Bounty →" CTA button (pill, primary)       │
    └──────────────────────────────────────────────────┘

[ SLIDE-OVER PANEL (on card CTA click) ]
  Right-anchored panel, 480px wide, glass bg:
    Close X (top-right)
    Full task description
    Acceptance criteria list (JetBrains Mono, each item a checkbox-style row)
    Volume stats expanded (chart placeholder or sparkline)
    "Post Bounty" large CTA → triggers auth stub modal
    
[ AUTH STUB MODAL (on "Post Bounty") ]
  Center modal, glass:
    "Sign in to post a bounty"
    "Demo mode — authentication not required for the live demo run"
    "Watch the Demo →" (redirects to hero run) | "Dismiss"
```

**States:**

| State | Behavior |
|-------|----------|
| Loading | Grid: skeleton cards with shimmer |
| Populated | Card grid renders; filter chips enabled |
| Filter empty | "No listings in this category" ghost card |
| Slide-over loading | Spinner inside panel while detail loads (instant for seeded data) |
| Error | Alert bar below filter rail |

**Responsive:**
- Desktop: 3-col grid + right slide-over.
- Tablet: 2-col grid + slide-over (full-width on narrow tablet).
- Mobile: 1-col grid; slide-over becomes full-screen bottom sheet.

---

## Interaction & Motion Notes

**Marbled-ink wave (Landing hero):** CSS gradient mesh + subtle keyframe transform (translate + rotate, 12–16s cycle). Gate behind `prefers-reduced-motion: reduce` — fallback is a static gradient using the same paint colors.

**Pipeline stage transitions:** `stage:start` SSE event triggers a 260ms ease-out expand of the active stage section. Completed stages collapse to a 56px accordion header. Easing: `cubic-bezier(0.16,1,0.3,1)`.

**AgentCard status pill:** Transitions between states via cross-fade (180ms). "Working" state uses a 2s looping pulse animation on the paint-blue pip.

**VerdictCard entry:** Cards slide up from 12px below origin, opacity 0→1, 260ms ease-out. Sub-score progress bars fill after a 100ms delay (avoids simultaneous animation overload). Sub-score order is always fixed: `criteriaMatch` → `completeness` → `validity`.

**Stagger:** Card grids (Browse, Listings) and AgentCards stagger 40ms per item. Keep stagger total under 200ms (5 items max visible delay).

**Escrow settle animation:** Paint-orange token icon travels from escrow badge in left rail to AgentCard C in main canvas (CSS keyframe translate, 600ms). After animation: escrow badge label changes to "Settled — $500" (paint-cyan).

**Leaderboard rank update:** Affected row briefly highlights paint-cyan at 15% opacity, fades to transparent over 3s. Rank number counter-ticks from old rank to new.

**Count-up:** Live stats tiles and leaderboard scores animate from 0 to value on mount using a 800ms linear counter. Triggered once; does not repeat on re-render.

**Reduced motion fallbacks:** All keyframe animations are inside a `@media (prefers-reduced-motion: no-preference)` block or conditional CSS class. Fallback: instant state changes, no motion, no wave drift.

---

## Accessibility Notes

**Color contrast:** All body text on glass cards must meet WCAG 2.1 AA (4.5:1 for body 14px, 3:1 for large text 24px+). The ink-900 base + white text combination passes. Functional colors (fail #FF3D6E, pass #21E6C1) are never used as the sole indicator — always paired with text labels ("FAIL", "PASS") and/or icons.

**Keyboard navigation:**
- All interactive elements (cards, chips, table rows, CTAs) reachable by Tab in logical DOM order.
- BountyCard and ListingCard: `role="button"` or anchor-wrapped; Enter/Space activates.
- AgentCard live log region: `aria-live="polite"` so screen readers announce new log lines without interrupting.
- VerdictCard: `aria-label="Verdict for Agent X: FAIL"` on the badge element.
- Pipeline stage pips: `role="list"` + `role="listitem"` with `aria-label="Stage 2 of 4: Compete — active"`.

**Screen reader support:**
- SSE-driven updates use `aria-live="polite"` on the stage banner and `aria-live="assertive"` only for the final settle event (highest-priority announcement).
- Animated number counters: wrap in `aria-label` with the final value so screen readers announce the target, not each intermediate number.
- The animated escrow token flight is `aria-hidden="true"` (decorative).

**Focus management:**
- When VerdictCard renders, focus does NOT automatically move to it (would interrupt watching the pipeline). Instead, a skip-to-verdict link appears in the tab order after the oracle panel header.
- Slide-over panel (Listings): focus traps inside panel while open; Escape closes and returns focus to the triggering card.
- Modal (auth stub): focus traps inside; Escape closes.

**Motion safety:** All CSS animations conditional on `prefers-reduced-motion: no-preference`. The animated wave and pipeline auto-play are gated — this is a non-negotiable requirement from the visual identity spec.

**Touch targets:** All interactive elements minimum 44×44px touch target. Chip strips horizontally scrollable (touch-action: pan-x). Table row expand area is the full row width (not just text).
