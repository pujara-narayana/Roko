// ─────────────────────────────────────────────
//  Typed fetch client for the Bounty backend.
//  All endpoints return { ok, data } | { ok:false, error }.
// ─────────────────────────────────────────────

import type {
  ApiResponse, Agent, Bounty, Escrow, OracleBatchResult,
  PlatformStats, Run, ProviderStatus, TaskType,
} from '@/lib/types';

export interface CreateAgentInput {
  name: string;
  systemPrompt: string;
  emoji?: string;
  browserbase?: boolean;
}

export interface CreateBountyInput {
  title?: string;
  description: string;
  verification?: string;
  category: string;
  reward: number;
  taskType?: TaskType;
  timeToCompleteMin?: number;
  attachments?: string[];
  poster?: string;
}

export interface StatsResponse extends PlatformStats {
  avgVerificationLabel: string;
  totalEscrowLabel: string;
}

export interface RankedAgent {
  rank: number;
  agentId: string;
  agentName: string;
  specialty?: string;
  emoji?: string;
  verified?: boolean;
  categories?: string[];
  reputationScore: number;
  totalBounties: number;
  passRate: number;
  wins: number;
  losses: number;
  earningsUsd: number;
  avgCriteriaMatch: number;
  avgCompleteness: number;
  avgValidity: number;
  lastActive?: string;
}

export interface Listing {
  listingId: string;
  title: string;
  category: string;
  description: string;
  pricePerUnit: number;
  minOrder: number;
  totalCompleted: number;
  passRate: number;
  avgDurationMin: number;
  enrichable?: boolean;
}

export interface BountyDetail {
  bounty: Bounty;
  escrow?: Escrow | null;
  oracle?: OracleBatchResult | null;
}

async function getJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = (await res.json()) as ApiResponse<T>;
  if (!body.ok) throw new Error(body.error || `Request failed: ${url}`);
  return body.data;
}

export const api = {
  getStats: () => getJSON<StatsResponse>('/api/stats'),
  getBounties: () => getJSON<Bounty[]>('/api/bounties'),
  getBounty: (id: string) => getJSON<BountyDetail>(`/api/bounties/${id}`),
  getLeaderboard: (category?: string) =>
    getJSON<RankedAgent[]>(`/api/leaderboard${category && category !== 'All' ? `?category=${encodeURIComponent(category)}` : ''}`),
  getProviders: () => getJSON<ProviderStatus[]>('/api/providers'),
  getListings: () => getJSON<Listing[]>('/api/listings'),
  createBounty: (input: CreateBountyInput) =>
    getJSON<{ bounty: Bounty; bestAgent?: RankedAgent | null; awaitingKey?: string | null }>('/api/bounties', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  startRun: (bountyId: string, injectAgentId?: string) =>
    getJSON<{ runId: string; streamUrl: string }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ bountyId, injectAgentId }),
    }),
  getRun: (runId: string) => getJSON<Run>(`/api/runs/${runId}`),

  // ── User-created agents ──
  getAgents: () => getJSON<Agent[]>('/api/agents'),
  getAgent: (id: string) => getJSON<Agent & { rank: number }>(`/api/agents/${id}`),
  createAgent: (input: CreateAgentInput) =>
    getJSON<Agent>('/api/agents', { method: 'POST', body: JSON.stringify(input) }),
  deleteAgent: (id: string) =>
    getJSON<{ deleted: string }>(`/api/agents/${id}`, { method: 'DELETE' }),
  addSubscription: (id: string, sub: { template: string; minPayout: number; maxPayout: number }) =>
    getJSON<Agent>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'addSubscription', ...sub }),
    }),
  removeSubscription: (id: string, subscriptionId: string) =>
    getJSON<Agent>(`/api/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ action: 'removeSubscription', subscriptionId }),
    }),
};
