/**
 * Seeded fixtures for the hero bounty demo.
 * All data is deterministic and static — no external API calls needed.
 */

import type {
  Agent, Bounty, CompanyRecord, Submission,
  AcceptanceRequirements,
} from '../types';

// ─── Agents ──────────────────────────────────────────────────────────────────

export const SEED_AGENTS: Agent[] = [
  {
    agentId: 'agent-alpha',
    name: 'Agent Alpha',
    model: 'claude-opus-4',
    description: 'Specializes in lead generation — fast but sometimes misses criteria.',
    reputation: 420,
    earningsUsd: 3200,
    wins: 8,
    losses: 5,
    completions: 13,
    passRate: 61.5,
    avgCriteriaMatch: 74,
    avgCompleteness: 72,
    avgValidity: 78,
    lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    agentId: 'agent-beta',
    name: 'Agent Beta',
    model: 'claude-sonnet-4',
    description: 'High throughput data enrichment agent. Struggles with email validation.',
    reputation: 310,
    earningsUsd: 1800,
    wins: 5,
    losses: 8,
    completions: 13,
    passRate: 38.5,
    avgCriteriaMatch: 88,
    avgCompleteness: 90,
    avgValidity: 62,
    lastActive: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    agentId: 'agent-charlie',
    name: 'Agent Charlie',
    model: 'claude-opus-4',
    description: 'Precision-first research agent with verified contact enrichment.',
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
];

// ─── Hero bounty ─────────────────────────────────────────────────────────────

export const HERO_BOUNTY_ID = 'bounty-hero-001';

export const HERO_BOUNTY: Bounty = {
  bountyId: HERO_BOUNTY_ID,
  title: 'Find 20 US Fintech VP-of-Engineering Emails',
  description:
    'Find 20 US-based fintech companies with verified revenue ≥ $1M ARR, each with a verified VP-of-Engineering email address. All contacts must be current employees — no bounced addresses.',
  category: 'Data & Research',
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

// ─── Exported submission data ─────────────────────────────────────────────────

export function getAlphaRecords(): CompanyRecord[] {
  return [...ALPHA_GOOD, ...ALPHA_BAD, ...ALPHA_DUPES];
}

export function getBetaRecords(): CompanyRecord[] {
  return BETA_RECORDS;
}

export function getCharlieRecords(): CompanyRecord[] {
  return [...GOOD_COMPANIES]; // perfect: 20/20
}

// ─── Additional seeded bounties for Browse page ───────────────────────────────

export const SEED_BOUNTIES: Bounty[] = [
  HERO_BOUNTY,
  {
    bountyId: 'bounty-002',
    title: 'Scrape 50 SaaS Pricing Pages',
    description: 'Extract pricing tiers, features, and prices from 50 B2B SaaS websites.',
    category: 'Data & Research',
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
    category: 'Lead Generation',
    reward: 400,
    poster: 'demo-poster',
    status: 'in_progress',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    bountyId: 'bounty-004',
    title: 'Monitor Competitor Pricing Changes Weekly',
    description: 'Track pricing changes for 10 competitor SaaS products and alert on any changes.',
    category: 'Data & Research',
    reward: 200,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
  },
  {
    bountyId: 'bounty-005',
    title: 'Generate 100 Product Demo Scripts',
    description: 'Create personalized cold outreach scripts for enterprise sales reps targeting fintech CTOs.',
    category: 'Content',
    reward: 600,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    bountyId: 'bounty-006',
    title: 'Find Series A Investors in Climate Tech',
    description: 'Identify 25 active Series A investors specializing in climate/cleantech with verified emails.',
    category: 'Lead Generation',
    reward: 450,
    poster: 'demo-poster',
    status: 'open',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

// ─── Listings / task template data ───────────────────────────────────────────

export const SEED_LISTINGS = [
  {
    listingId: 'listing-001',
    title: 'Company Research & Lead Gen',
    category: 'Data & Research',
    description: 'Find companies matching custom criteria with verified contact info.',
    pricePerUnit: 25,
    minOrder: 10,
    totalCompleted: 847,
    passRate: 94,
    avgDurationMin: 4,
  },
  {
    listingId: 'listing-002',
    title: 'Outreach Campaign Execution',
    category: 'Outreach',
    description: 'Send personalized outreach sequences to target lists, track opens/replies.',
    pricePerUnit: 5,
    minOrder: 50,
    totalCompleted: 312,
    passRate: 91,
    avgDurationMin: 8,
  },
  {
    listingId: 'listing-003',
    title: 'AI Headshot Generation',
    category: 'AI Media',
    description: 'Generate professional headshots from casual photos with custom backgrounds.',
    pricePerUnit: 3,
    minOrder: 5,
    totalCompleted: 2140,
    passRate: 98,
    avgDurationMin: 2,
  },
  {
    listingId: 'listing-004',
    title: 'Competitor Intelligence Report',
    category: 'Data & Research',
    description: 'Deep-dive competitor analysis: pricing, features, positioning, and reviews.',
    pricePerUnit: 150,
    minOrder: 1,
    totalCompleted: 189,
    passRate: 89,
    avgDurationMin: 15,
  },
  {
    listingId: 'listing-005',
    title: 'SEO Content Generation',
    category: 'Content',
    description: 'Write keyword-optimized blog posts with verified fact-checking.',
    pricePerUnit: 80,
    minOrder: 1,
    totalCompleted: 534,
    passRate: 96,
    avgDurationMin: 6,
  },
  {
    listingId: 'listing-006',
    title: 'LinkedIn Decision Maker Finder',
    category: 'Lead Generation',
    description: 'Find verified decision-maker contacts at target accounts via LinkedIn.',
    pricePerUnit: 15,
    minOrder: 20,
    totalCompleted: 1023,
    passRate: 92,
    avgDurationMin: 5,
  },
];
