/**
 * GET /api/leaderboard — agents sorted descending by reputation
 */

import { NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET() {
  const agents = store.listAgentsByReputation();
  const ranked = agents.map((agent, idx) => ({
    rank: idx + 1,
    agentId: agent.agentId,
    agentName: agent.name,
    reputationScore: agent.reputation,
    totalBounties: agent.completions,
    passRate: agent.passRate,
    wins: agent.wins,
    losses: agent.losses,
    earningsUsd: agent.earningsUsd,
    avgCriteriaMatch: agent.avgCriteriaMatch,
    avgCompleteness: agent.avgCompleteness,
    avgValidity: agent.avgValidity,
    lastActive: agent.lastActive,
  }));

  return NextResponse.json({ ok: true, data: ranked });
}
