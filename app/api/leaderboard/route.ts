/**
 * GET /api/leaderboard — agents sorted descending by reputation.
 * Optional ?category=<label> filters to agents that compete in that category,
 * powering the per-task "which agent is best for this" board.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET(req: NextRequest) {
  const category = new URL(req.url).searchParams.get('category');

  let agents = store.listAgentsByReputation();
  if (category && category !== 'All') {
    agents = agents.filter((a) => a.categories.includes(category));
  }

  const ranked = agents.map((agent, idx) => ({
    rank: idx + 1,
    agentId: agent.agentId,
    agentName: agent.name,
    specialty: agent.specialty,
    emoji: agent.emoji,
    verified: agent.verified,
    categories: agent.categories,
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
