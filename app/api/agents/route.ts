/**
 * GET  /api/agents  — list user-created agents
 * POST /api/agents  — create a user agent (registers it on Agentverse)
 *
 * User agents are custom-prompt agents that compete on the existing
 * Claude + Browserbase pipeline. Registration on Fetch.ai Agentverse is
 * best-effort and never blocks creation (graceful local-only fallback).
 */

import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { fetchai } from '@/lib/providers';
import type { Agent } from '@/lib/types';

seedStore();

const MAX_USER_AGENTS = 3;
const DEFAULT_MODEL = 'claude-opus-4-8';

function apiKey(): string {
  return `sk_${randomBytes(24).toString('hex')}`;
}

function slugId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 24) || 'agent';
  return `agent-user-${base}-${randomBytes(3).toString('hex')}`;
}

export async function GET() {
  return NextResponse.json({ ok: true, data: store.listUserAgents() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt.trim() : '';
    const emoji = typeof body.emoji === 'string' && body.emoji ? body.emoji : '🤖';
    const browserbase = !!body.browserbase;

    if (name.length < 2 || name.length > 24) {
      return NextResponse.json({ ok: false, error: 'Name must be 2–24 characters.' }, { status: 400 });
    }
    if (systemPrompt.length < 20) {
      return NextResponse.json({ ok: false, error: 'System prompt must be at least 20 characters.' }, { status: 400 });
    }
    if (store.listUserAgents().length >= MAX_USER_AGENTS) {
      return NextResponse.json(
        { ok: false, error: `You've hit the ${MAX_USER_AGENTS}-agent cap. Delete one to make room.` },
        { status: 409 },
      );
    }

    // Best-effort Agentverse registration — never throws; returns local-only
    // when the key is missing or the call fails.
    const agentverse = await fetchai.registerAgent({ name, systemPrompt });

    const agent: Agent = {
      agentId: slugId(name),
      name,
      model: DEFAULT_MODEL,
      description: systemPrompt.slice(0, 140),
      specialty: 'research',
      emoji,
      tools: ['Claude reasoning', ...(browserbase ? ['Browserbase web'] : [])],
      providers: ['anthropic', ...(browserbase ? ['browserbase' as const] : [])],
      categories: [],
      verified: false,
      reputation: 0,
      earningsUsd: 0,
      wins: 0,
      losses: 0,
      completions: 0,
      passRate: 0,
      avgCriteriaMatch: 0,
      avgCompleteness: 0,
      avgValidity: 0,
      lastActive: new Date().toISOString(),
      userCreated: true,
      systemPrompt,
      apiKey: apiKey(),
      agentverse,
      subscriptions: [],
      capabilities: { claude: true, browserbase },
    };

    store.setAgent(agent);
    return NextResponse.json({ ok: true, data: agent });
  } catch (err) {
    console.error('/api/agents POST error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to create agent' }, { status: 500 });
  }
}
