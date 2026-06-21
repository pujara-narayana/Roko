/**
 * GET /api/bounties/:id — get single bounty
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bounty = store.getBounty(id);
  if (!bounty) {
    return NextResponse.json({ ok: false, error: 'Bounty not found' }, { status: 404 });
  }
  const escrow = store.getEscrow(id);
  const oracle = store.getOracleBatch(id);
  return NextResponse.json({ ok: true, data: { bounty, escrow, oracle } });
}
