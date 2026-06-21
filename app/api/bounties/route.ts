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
import { HERO_BOUNTY_ID } from '@/lib/seed/fixtures';
import type { Bounty } from '@/lib/types';

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
      category = 'Data & Research',
      reward = 500,
      poster = 'demo-poster',
    } = body as Record<string, unknown>;

    // Intake agent: compile requirements
    const requirements = compileRequirements(String(description));
    const bountyId = uuid();
    const now = new Date().toISOString();

    const bounty: Bounty = {
      bountyId,
      title: String(title) || `Bounty: ${String(description).slice(0, 60)}…`,
      description: String(description),
      category: String(category),
      reward: Number(reward) || 500,
      poster: String(poster),
      status: 'open',
      requirements,
      requirementsId: `req-${bountyId}`,
      createdAt: now,
      updatedAt: now,
    };

    store.setBounty(bounty);

    // Fund mock escrow
    const escrow = fundEscrow(bountyId, bounty.reward);
    bounty.escrowId = escrow.escrowId;
    store.setBounty(bounty);

    return NextResponse.json({ ok: true, data: { bounty, requirements, escrow } }, { status: 200 });
  } catch (err) {
    console.error('/api/bounties POST error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to create bounty', code: 'INTAKE_ERROR' },
      { status: 500 }
    );
  }
}
