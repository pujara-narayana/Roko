/**
 * GET  /api/bounties — list all bounties
 * POST /api/bounties — create bounty + compile requirements (intake agent)
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuid } from 'uuid';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { compileRequirements } from '@/lib/intake';
import { fundEscrow } from '@/lib/escrow';
import { resolveTaskType, specialtyForTaskType } from '@/lib/categories';
import { firstMissingProvider } from '@/lib/providers';
import type { Bounty, TaskType } from '@/lib/types';

seedStore();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const status = searchParams.get('status');

  let bounties = store.listBounties();
  if (category && category !== 'All') {
    bounties = bounties.filter(b => b.category.toLowerCase() === category.toLowerCase());
  }
  if (status) {
    bounties = bounties.filter(b => b.status === status);
  }

  return NextResponse.json({ ok: true, data: bounties });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const {
      description = '',
      title = '',
      verification = '',
      category = 'Sales & Lead Generation',
      reward = 100,
      timeToCompleteMin,
      attachments,
      poster = 'demo-poster',
    } = body as Record<string, unknown>;

    const desc = String(description).trim();
    if (!desc) {
      return NextResponse.json({ ok: false, error: 'description is required' }, { status: 400 });
    }

    // Intake: classify the task type (keyword routing within the chosen category).
    const brief = `${desc} ${String(verification)}`;
    const taskType: TaskType =
      (body as { taskType?: TaskType }).taskType ?? resolveTaskType(String(category), brief);

    // Data/research tasks compile checkable requirements; other types verify the deliverable.
    const requirements = taskType === 'data-research' ? compileRequirements(desc) : undefined;

    const bountyId = uuid();
    const now = new Date().toISOString();

    const bounty: Bounty = {
      bountyId,
      title: String(title).trim() || `${desc.slice(0, 56)}${desc.length > 56 ? '…' : ''}`,
      description: desc,
      category: String(category),
      taskType,
      verification: String(verification).trim() || undefined,
      timeToCompleteMin: timeToCompleteMin != null ? Number(timeToCompleteMin) : undefined,
      attachments: Array.isArray(attachments) ? attachments.map(String) : undefined,
      reward: Math.max(1, Number(reward) || 1),
      poster: String(poster),
      status: 'open',
      requirements,
      requirementsId: requirements ? `req-${bountyId}` : undefined,
      createdAt: now,
      updatedAt: now,
    };

    store.setBounty(bounty);

    // Fund mock escrow (payments are hardcoded — no real charge).
    const escrow = fundEscrow(bountyId, bounty.reward);
    bounty.escrowId = escrow.escrowId;
    store.setBounty(bounty);

    // Resolve the best-fit agent + warn if its provider key is missing.
    const specialty = specialtyForTaskType(taskType);
    const agent = store.listAgentsByReputation().find((a) => a.specialty === specialty);
    const awaitingKey = agent ? firstMissingProvider(agent.providers) : null;

    const bestAgent = agent
      ? {
          rank: 1, agentId: agent.agentId, agentName: agent.name, specialty: agent.specialty,
          emoji: agent.emoji, verified: agent.verified, categories: agent.categories,
          reputationScore: agent.reputation, totalBounties: agent.completions, passRate: agent.passRate,
          wins: agent.wins, losses: agent.losses, earningsUsd: agent.earningsUsd,
          avgCriteriaMatch: agent.avgCriteriaMatch, avgCompleteness: agent.avgCompleteness,
          avgValidity: agent.avgValidity, lastActive: agent.lastActive,
        }
      : null;

    return NextResponse.json(
      { ok: true, data: { bounty, requirements, escrow, bestAgent, awaitingKey } },
      { status: 200 },
    );
  } catch (err) {
    console.error('/api/bounties POST error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to create bounty', code: 'INTAKE_ERROR' },
      { status: 500 }
    );
  }
}
