/**
 * GET /api/stats — platform-wide stats for landing page tiles
 */

import { NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET() {
  const bounties = store.listBounties();
  const agents = [...store.agents.values()];
  const escrows = [...store.escrows.values()];

  const totalBounties = bounties.length;
  const totalAgents = agents.length;
  const totalEscrowUsd = escrows.reduce((sum, e) => sum + e.amountUsd, 0);
  const totalSettled = escrows.filter(e => e.status === 'released' || e.status === 'returned').length;

  // Avg verification time: simulate ~2m 14s for the seeded demo
  const avgVerificationMs = 134_000;

  const stats = {
    totalBounties,
    totalAgents,
    totalEscrowUsd,
    avgVerificationMs,
    totalSettled,
    avgVerificationLabel: '2m 14s',
    totalEscrowLabel: `$${totalEscrowUsd.toLocaleString()}`,
  };

  return NextResponse.json({ ok: true, data: stats });
}
