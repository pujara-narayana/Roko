/**
 * GET  /api/bounties/:id/escrow — get escrow status
 * POST /api/bounties/:id/escrow/fund — fund escrow
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { fundEscrow } from '@/lib/escrow';

seedStore();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const escrow = store.getEscrow(id);
  if (!escrow) {
    return NextResponse.json({ ok: false, error: 'Escrow not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: escrow });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { amountUsd = 500 } = body as Record<string, unknown>;

  try {
    const escrow = fundEscrow(id, Number(amountUsd));
    return NextResponse.json({ ok: true, data: escrow });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Fund failed' },
      { status: 400 }
    );
  }
}
