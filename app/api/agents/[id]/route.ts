/**
 * GET /api/agents/:id — get single agent profile
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
  const agent = store.getAgent(id);
  if (!agent) {
    return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
  }
  const rank = store.listAgentsByReputation().findIndex(a => a.agentId === id) + 1;
  return NextResponse.json({ ok: true, data: { ...agent, rank } });
}
