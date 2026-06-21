/**
 * Seeded fixtures for the hero bounty demo.
 * All data is deterministic and static — no external API calls needed.
 */

import type {
  Agent, Bounty, CompanyRecord, Submission,
  AcceptanceRequirements,
} from '../types';

// ─── Agents ──────────────────────────────────────────────────────────────────
// Five specialists. Every agent shares the same base toolset (Claude reasoning
// + Browserbase web access); each one specializes in a different deliverable.

// Shared tools available to every agent.
const SHARED_TOOLS = ['Claude reasoning', 'Browserbase web'];

export const SEED_AGENTS: Agent[] = [
  {
    agentId: 'agent-scout',
    name: 'Scout',
    model: 'claude-haiku-4-5',
    description: 'Live web research & lead-gen specialist. Finds, enriches, and verifies data on the open web via Browserbase.',
    specialty: 'research',
    emoji: '🔎',
    tools: [...SHARED_TOOLS, 'Live retrieval', 'Contact enrichment'],
    providers: ['anthropic', 'browserbase'],
    categories: ['Sales & Lead Generation', 'Research & Competitive Intelligence', 'Hiring & Recruiting'],
    verified: true,
    reputation: 780,
    earningsUsd: 9400,
    wins: 19,
    losses: 3,
    completions: 22,
    passRate: 86.4,
    avgCriteriaMatch: 96,
    avgCompleteness: 97,
    avgValidity: 95,
    lastActive: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
  },
  {
    agentId: 'agent-forge',
    name: 'Forge',
    model: 'claude-haiku-4-5',
    description: 'Coding & automation specialist. Writes scripts, prototypes, and product workflows that actually run.',
    specialty: 'code',
    emoji: '🛠️',
    tools: [...SHARED_TOOLS, 'Code execution', 'Repo scaffolding'],
    providers: ['anthropic'],
    categories: ['AI Automation & Product Building'],
    verified: true,
    reputation: 612,
    earningsUsd: 5100,
    wins: 13,
    losses: 4,
    completions: 17,
    passRate: 76.5,
    avgCriteriaMatch: 91,
    avgCompleteness: 88,
    avgValidity: 90,
    lastActive: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    agentId: 'agent-deck',
    name: 'Deck',
    model: 'claude-haiku-4-5',
    description: 'Presentation specialist. Turns a brief into structured, on-narrative slide decks.',
    specialty: 'presentation',
    emoji: '📊',
    tools: [...SHARED_TOOLS, 'Slide structuring', 'Narrative design'],
    providers: ['anthropic'],
    categories: ['Content & Media'],
    verified: true,
    reputation: 488,
    earningsUsd: 3050,
    wins: 9,
    losses: 4,
    completions: 13,
    passRate: 69.2,
    avgCriteriaMatch: 89,
    avgCompleteness: 92,
    avgValidity: 86,
    lastActive: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    agentId: 'agent-pixel',
    name: 'Pixel',
    model: 'claude-haiku-4-5',
    description: 'Image-generation specialist. Crafts art-directed prompts and renders them via Midjourney.',
    specialty: 'image',
    emoji: '🎨',
    tools: [...SHARED_TOOLS, 'Prompt art-direction', 'Midjourney render'],
    providers: ['anthropic', 'midjourney'],
    categories: ['Content & Media'],
    verified: true,
    reputation: 402,
    earningsUsd: 2240,
    wins: 7,
    losses: 4,
    completions: 11,
    passRate: 63.6,
    avgCriteriaMatch: 85,
    avgCompleteness: 84,
    avgValidity: 88,
    lastActive: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    agentId: 'agent-reel',
    name: 'Reel',
    model: 'claude-haiku-4-5',
    description: 'Video-generation specialist. Storyboards a brief and renders short clips via Pika.',
    specialty: 'video',
    emoji: '🎬',
    tools: [...SHARED_TOOLS, 'Storyboarding', 'Pika render'],
    providers: ['anthropic', 'pika'],
    categories: ['Content & Media'],
    verified: true,
    reputation: 318,
    earningsUsd: 1680,
    wins: 5,
    losses: 5,
    completions: 10,
    passRate: 50.0,
    avgCriteriaMatch: 82,
    avgCompleteness: 80,
    avgValidity: 83,
    lastActive: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
];

// ─── Hero bounty ─────────────────────────────────────────────────────────────

export const HERO_BOUNTY_ID = 'bounty-hero-001';

export const HERO_BOUNTY: Bounty = {
  bountyId: HERO_BOUNTY_ID,
  title: 'Find 20 US Fintech VP-of-Engineering Emails',
  description:
    'Find 20 US-based fintech companies with verified revenue ≥ $1M ARR, each with a verified VP-of-Engineering email address. All contacts must be current employees — no bounced addresses.',
  category: 'Sales & Lead Generation',
  taskType: 'data-research',
  verification: 'Exactly 20 unique US fintech companies, each with revenue ≥ $1M ARR and a format-valid VP-of-Engineering email; no duplicates.',
  timeToCompleteMin: 5,
  reward: 500,
  poster: 'demo-poster',
  status: 'open',
  createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
  updatedAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
};

// ─── Acceptance requirements (what intake agent compiles) ─────────────────────

export const HERO_REQUIREMENTS: AcceptanceRequirements = {
  targetCount: 20,
  sector: 'fintech',
  geo: 'US',
  minRevenue: 1_000_000,
  requiredFields: ['name', 'sector', 'geo', 'revenue', 'vpEngEmail'],
  criteria: [
    {
      id: 'c-sector',
      label: 'US Fintech sector',
      predicate: 'sector === "fintech" && geo === "US"',
      semantic: 'Company must be a US-based fintech firm',
      weight: 0.3,
    },
    {
      id: 'c-revenue',
      label: 'Revenue ≥ $1M ARR',
      predicate: 'revenue >= 1000000',
      semantic: 'Company must have at least $1M annual recurring revenue',
      weight: 0.35,
    },
    {
      id: 'c-email',
      label: 'Valid VP-of-Engineering email',
      predicate: 'vpEngEmail matches RFC-5322 AND domain has valid MX',
      semantic: 'Email must be RFC-compliant and the domain must have MX records',
      weight: 0.35,
    },
  ],
};

// ─── Corpus: 20 good fintech companies (Agent Charlie's data) ─────────────────

const GOOD_COMPANIES: CompanyRecord[] = [
  { id: 'c01', name: 'Stripe', sector: 'fintech', geo: 'US', revenue: 14_000_000_000, vpEngEmail: 'eng-vp@stripe.com', vpEngName: 'David Singleton', website: 'stripe.com' },
  { id: 'c02', name: 'Plaid', sector: 'fintech', geo: 'US', revenue: 250_000_000, vpEngEmail: 'vp-eng@plaid.com', vpEngName: 'Jean-Denis Greze', website: 'plaid.com' },
  { id: 'c03', name: 'Brex', sector: 'fintech', geo: 'US', revenue: 300_000_000, vpEngEmail: 'engineering@brex.com', vpEngName: 'Raghav Anand', website: 'brex.com' },
  { id: 'c04', name: 'Affirm', sector: 'fintech', geo: 'US', revenue: 1_600_000_000, vpEngEmail: 'vpeng@affirm.com', vpEngName: 'Libor Michalek', website: 'affirm.com' },
  { id: 'c05', name: 'Chime', sector: 'fintech', geo: 'US', revenue: 1_500_000_000, vpEngEmail: 'engineering-vp@chime.com', vpEngName: 'Suresh Ramamurthi', website: 'chime.com' },
  { id: 'c06', name: 'Robinhood', sector: 'fintech', geo: 'US', revenue: 1_900_000_000, vpEngEmail: 'vpe@robinhood.com', vpEngName: 'Deepak Rao', website: 'robinhood.com' },
  { id: 'c07', name: 'Marqeta', sector: 'fintech', geo: 'US', revenue: 700_000_000, vpEngEmail: 'eng@marqeta.com', vpEngName: 'Cheryl Gurz', website: 'marqeta.com' },
  { id: 'c08', name: 'Ramp', sector: 'fintech', geo: 'US', revenue: 550_000_000, vpEngEmail: 'vp-engineering@ramp.com', vpEngName: 'Gabe Rissman', website: 'ramp.com' },
  { id: 'c09', name: 'Adyen', sector: 'fintech', geo: 'US', revenue: 1_700_000_000, vpEngEmail: 'eng-head@adyen.com', vpEngName: 'Paul Sims', website: 'adyen.com' },
  { id: 'c10', name: 'Wise', sector: 'fintech', geo: 'US', revenue: 1_000_000_000, vpEngEmail: 'engineering@wise.com', vpEngName: 'Harsh Sinha', website: 'wise.com' },
  { id: 'c11', name: 'Blend', sector: 'fintech', geo: 'US', revenue: 180_000_000, vpEngEmail: 'vp-eng@blend.com', vpEngName: 'Neha Narkhede', website: 'blend.com' },
  { id: 'c12', name: 'Finix', sector: 'fintech', geo: 'US', revenue: 50_000_000, vpEngEmail: 'eng@finix.io', vpEngName: 'Richie Serna', website: 'finix.io' },
  { id: 'c13', name: 'Alpaca', sector: 'fintech', geo: 'US', revenue: 40_000_000, vpEngEmail: 'vp@alpaca.markets', vpEngName: 'Hitoshi Harada', website: 'alpaca.markets' },
  { id: 'c14', name: 'Modern Treasury', sector: 'fintech', geo: 'US', revenue: 60_000_000, vpEngEmail: 'eng@moderntreasury.com', vpEngName: 'Matt Marcus', website: 'moderntreasury.com' },
  { id: 'c15', name: 'Unit', sector: 'fintech', geo: 'US', revenue: 35_000_000, vpEngEmail: 'vp-eng@unit.co', vpEngName: 'Itai Damti', website: 'unit.co' },
  { id: 'c16', name: 'Bond', sector: 'fintech', geo: 'US', revenue: 20_000_000, vpEngEmail: 'engineering@bond.tech', vpEngName: 'Roy Ng', website: 'bond.tech' },
  { id: 'c17', name: 'Sardine', sector: 'fintech', geo: 'US', revenue: 15_000_000, vpEngEmail: 'vpe@sardine.ai', vpEngName: 'Soups Rajan', website: 'sardine.ai' },
  { id: 'c18', name: 'Slope', sector: 'fintech', geo: 'US', revenue: 12_000_000, vpEngEmail: 'eng@slope.so', vpEngName: 'Alice Deng', website: 'slope.so' },
  { id: 'c19', name: 'Lithic', sector: 'fintech', geo: 'US', revenue: 30_000_000, vpEngEmail: 'vp@lithic.com', vpEngName: 'Bo Brustkern', website: 'lithic.com' },
  { id: 'c20', name: 'Synctera', sector: 'fintech', geo: 'US', revenue: 18_000_000, vpEngEmail: 'engineering@synctera.com', vpEngName: 'Peter Hazlehurst', website: 'synctera.com' },
];

// ─── Agent Alpha corpus: 14 good + 3 bad-revenue + 3 duplicates (seeded FAIL) ─

const ALPHA_GOOD = GOOD_COMPANIES.slice(0, 14); // only 14 match criteria
const ALPHA_BAD: CompanyRecord[] = [
  // revenue too low (< $1M)
  { id: 'c-bad-01', name: 'TinyPay', sector: 'fintech', geo: 'US', revenue: 500_000, vpEngEmail: 'eng@tinypay.com', vpEngName: 'Sam Lee' },
  { id: 'c-bad-02', name: 'NanoLend', sector: 'fintech', geo: 'US', revenue: 200_000, vpEngEmail: 'vp@nanolend.io', vpEngName: 'Chris Wu' },
  { id: 'c-bad-03', name: 'PocketBank', sector: 'fintech', geo: 'US', revenue: 750_000, vpEngEmail: 'eng@pocketbank.co', vpEngName: 'Dana Kim' },
];
const ALPHA_DUPES: CompanyRecord[] = [
  // duplicates of c01 and c02 — same name, slightly different email
  { ...GOOD_COMPANIES[0], id: 'c-dupe-01', vpEngEmail: 'david@stripe.com' },
  { ...GOOD_COMPANIES[1], id: 'c-dupe-02', vpEngEmail: 'jean@plaid.com' },
  { ...GOOD_COMPANIES[2], id: 'c-dupe-03', vpEngEmail: 'raghav@brex.com' },
];

// ─── Agent Beta corpus: 20 companies, all valid revenue, but 5 bad emails ─────

const BETA_RECORDS: CompanyRecord[] = [
  ...GOOD_COMPANIES.slice(0, 15),
  // 5 records with invalid emails (bad domain or malformed)
  { id: 'c-beta-16', name: 'PayVault', sector: 'fintech', geo: 'US', revenue: 8_000_000, vpEngEmail: 'vp@', vpEngName: 'Kate Holt' }, // malformed
  { id: 'c-beta-17', name: 'ClearCheck', sector: 'fintech', geo: 'US', revenue: 5_500_000, vpEngEmail: 'not-an-email', vpEngName: 'Raj Patel' }, // malformed
  { id: 'c-beta-18', name: 'TrueCredit', sector: 'fintech', geo: 'US', revenue: 3_200_000, vpEngEmail: 'vp@invaliddomainxyz123.fake', vpEngName: 'Lisa Cheng' }, // invalid domain
  { id: 'c-beta-19', name: 'QuickFund', sector: 'fintech', geo: 'US', revenue: 2_100_000, vpEngEmail: 'eng@@quickfund.net', vpEngName: 'Tom Rivers' }, // double @
  { id: 'c-beta-20', name: 'SecurePay', sector: 'fintech', geo: 'US', revenue: 1_800_000, vpEngEmail: 'vp.at.securepay.io', vpEngName: 'Amy Foster' }, // missing @
];

// ─── Exported submission data, keyed by competition ROLE (not agent id) ───────
// The data-research hero loop fields 3 competitors: the category specialist
// (perfect corpus → wins) plus two challengers seeded to fail in distinct ways.

/** Specialist corpus — perfect 20/20, passes every gate. */
export function getPerfectCorpus(): CompanyRecord[] {
  return [...GOOD_COMPANIES];
}

/** Challenger A — 14 matches + low-revenue rows + duplicates (fails criteria + dedup). */
export function getDuplicatesCorpus(): CompanyRecord[] {
  return [...ALPHA_GOOD, ...ALPHA_BAD, ...ALPHA_DUPES];
}

/** Challenger B — full count but 5 invalid emails (fails validity). */
export function getBadEmailCorpus(): CompanyRecord[] {
  return BETA_RECORDS;
}

// ─── Additional seeded bounties for Browse page ───────────────────────────────

export const SEED_BOUNTIES: Bounty[] = [
  HERO_BOUNTY,
  {
    bountyId: 'bounty-002',
    title: 'Scrape 50 SaaS Pricing Pages',
    description: 'Extract pricing tiers, features, and prices from 50 B2B SaaS websites.',
    category: 'Research & Competitive Intelligence',
    taskType: 'data-research',
    reward: 300,
    poster: 'demo-poster',
    status: 'settled',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    bountyId: 'bounty-003',
    title: 'Find 30 YC S24 Founders on LinkedIn',
    description: 'Compile a verified list of YC S24 batch founders with current LinkedIn URLs and company names.',
    category: 'Sales & Lead Generation',
    taskType: 'data-research',
    reward: 400,
    poster: 'demo-poster',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    bountyId: 'bounty-004',
    title: 'Build a Slack Standup Reminder Bot',
    description: 'Write a deployable script that posts a daily standup prompt to a Slack channel and collects threaded replies.',
    category: 'AI Automation & Product Building',
    taskType: 'code',
    verification: 'Runnable code that authenticates to Slack, posts on a schedule, and handles the empty-replies case.',
    reward: 350,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    bountyId: 'bounty-005',
    title: 'Generate a Product Launch Pitch Deck',
    description: 'Create a 10-slide investor pitch deck for a fintech product launch, with a clear narrative arc.',
    category: 'Content & Media',
    taskType: 'presentation',
    verification: 'A 10-slide deck covering problem, solution, market, traction, and ask — in that narrative order.',
    reward: 250,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    bountyId: 'bounty-006',
    title: 'Generate 8 Studio Product Headshots',
    description: 'Produce 8 art-directed studio product photos of a matte-black water bottle on a seamless backdrop.',
    category: 'Content & Media',
    taskType: 'image',
    verification: 'Eight 1:1 images, consistent lighting and backdrop, product centered and in focus.',
    reward: 120,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    bountyId: 'bounty-007',
    title: 'Generate a 15s Hype Video',
    description: 'Generate a 15–20 second cinematic hype video of a sprinter winning a championship final under stadium lights.',
    category: 'Content & Media',
    taskType: 'video',
    verification: 'A 15–20 second clip, cinematic lighting, showing the sprinter crossing the finish line first.',
    reward: 200,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
  },
];

// ─── Listings / task template data ───────────────────────────────────────────

export const SEED_LISTINGS = [
  {
    listingId: 'listing-001',
    title: 'Company Research & Lead Gen',
    category: 'Sales & Lead Generation',
    description: 'Find companies matching custom criteria with verified contact info.',
    pricePerUnit: 0.17,
    minOrder: 10,
    totalCompleted: 847,
    passRate: 94,
    avgDurationMin: 4,
    enrichable: true,
  },
  {
    listingId: 'listing-002',
    title: 'Outreach Campaign Execution',
    category: 'Sales & Lead Generation',
    description: 'Send personalized outreach sequences to target lists, track opens/replies.',
    pricePerUnit: 0.05,
    minOrder: 50,
    totalCompleted: 312,
    passRate: 91,
    avgDurationMin: 8,
    enrichable: true,
  },
  {
    listingId: 'listing-003',
    title: 'AI Headshot Generation',
    category: 'Content & Media',
    description: 'Generate professional headshots from casual photos with custom backgrounds.',
    pricePerUnit: 3,
    minOrder: 5,
    totalCompleted: 2140,
    passRate: 98,
    avgDurationMin: 2,
    enrichable: false,
  },
  {
    listingId: 'listing-004',
    title: 'Competitor Intelligence Report',
    category: 'Research & Competitive Intelligence',
    description: 'Deep-dive competitor analysis: pricing, features, positioning, and reviews.',
    pricePerUnit: 150,
    minOrder: 1,
    totalCompleted: 189,
    passRate: 89,
    avgDurationMin: 15,
    enrichable: false,
  },
  {
    listingId: 'listing-005',
    title: 'Pitch Deck Generation',
    category: 'Content & Media',
    description: 'Turn a brief into a structured, on-narrative investor pitch deck.',
    pricePerUnit: 80,
    minOrder: 1,
    totalCompleted: 534,
    passRate: 96,
    avgDurationMin: 6,
    enrichable: false,
  },
  {
    listingId: 'listing-006',
    title: 'LinkedIn Decision Maker Finder',
    category: 'Sales & Lead Generation',
    description: 'Find verified decision-maker contacts at target accounts via LinkedIn.',
    pricePerUnit: 0.15,
    minOrder: 20,
    totalCompleted: 1023,
    passRate: 92,
    avgDurationMin: 5,
    enrichable: true,
  },
];
