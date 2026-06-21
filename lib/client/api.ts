// ─────────────────────────────────────────────
//  Typed fetch client for the Bounty backend.
//  All endpoints return { ok, data } | { ok:false, error }.
// ─────────────────────────────────────────────

import type {
  ApiResponse, Bounty, Escrow, OracleBatchResult,
  PlatformStats, Run,
} from '@/lib/types';

export interface StatsResponse extends PlatformStats {
  avgVerificationLabel: string;
  totalEscrowLabel: string;
}

export interface RankedAgent {
  rank: number;
  agentId: string;
  agentName: string;
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
  getLeaderboard: () => getJSON<RankedAgent[]>('/api/leaderboard'),
  getListings: () => getJSON<Listing[]>('/api/listings'),
  startRun: (bountyId: string) =>
    getJSON<{ runId: string; streamUrl: string }>('/api/runs', {
      method: 'POST',
      body: JSON.stringify({ bountyId }),
    }),
  getRun: (runId: string) => getJSON<Run>(`/api/runs/${runId}`),
};
