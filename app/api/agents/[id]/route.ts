/**
 * GET    /api/agents/:id — get single agent profile
 * PATCH  /api/agents/:id — manage subscriptions (add / remove)
 * DELETE /api/agents/:id — delete a user-created agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import type { AgentSubscription } from '@/lib/types';

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = store.getAgent(id);
  if (!agent || !agent.userCreated) {
    return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const subs = agent.subscriptions ?? [];

  if (body.action === 'addSubscription') {
    const template = typeof body.template === 'string' ? body.template.trim() : '';
    const minPayout = Number(body.minPayout);
    const maxPayout = Number(body.maxPayout);
    if (!template) {
      return NextResponse.json({ ok: false, error: 'Template is required.' }, { status: 400 });
    }
    if (!Number.isFinite(minPayout) || !Number.isFinite(maxPayout) || minPayout < 0 || maxPayout < minPayout) {
      return NextResponse.json({ ok: false, error: 'Min must be ≤ Max and both ≥ 0.' }, { status: 400 });
    }
    const sub: AgentSubscription = {
      id: `sub-${randomBytes(4).toString('hex')}`,
      template, minPayout, maxPayout,
    };
    agent.subscriptions = [...subs, sub];
  } else if (body.action === 'removeSubscription') {
    const subId = String(body.subscriptionId ?? '');
    agent.subscriptions = subs.filter(s => s.id !== subId);
  } else {
    return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
  }

  store.setAgent(agent);
  return NextResponse.json({ ok: true, data: agent });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const agent = store.getAgent(id);
  if (!agent || !agent.userCreated) {
    return NextResponse.json({ ok: false, error: 'Agent not found' }, { status: 404 });
  }
  store.deleteAgent(id);
  return NextResponse.json({ ok: true, data: { deleted: id } });
}
