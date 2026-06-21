/**
 * POST /api/runs — create a run and start the pipeline
 * Returns { runId, streamUrl } immediately; pipeline runs in background.
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { createRun, executePipeline } from '@/lib/pipeline';
import { HERO_BOUNTY_ID } from '@/lib/seed/fixtures';

seedStore();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bountyId = HERO_BOUNTY_ID, injectAgentId } = body as Record<string, unknown>;
    const inject = typeof injectAgentId === 'string' ? injectAgentId : undefined;

    const bounty = store.getBounty(String(bountyId));
    if (!bounty) {
      return NextResponse.json(
        { ok: false, error: `Bounty ${bountyId} not found` },
        { status: 404 }
      );
    }

    // Check if a run is already active for this bounty (idempotency). A user
    // dispatch ("Compete Now") always starts a fresh run so the chosen agent
    // is actually injected rather than re-attaching to a seeded run.
    if (!inject) {
      const existingRun = [...store.runs.values()].find(
        r => r.bountyId === String(bountyId) && r.status === 'running'
      );
      if (existingRun) {
        return NextResponse.json({
          ok: true,
          data: { runId: existingRun.runId, streamUrl: existingRun.streamUrl },
        });
      }
    }

    const run = createRun(bounty);

    // Fire-and-forget pipeline (runs in background)
    executePipeline(run, bounty, inject).catch(err => {
      console.error('[runs] Pipeline error:', err);
    });

    return NextResponse.json({
      ok: true,
      data: { runId: run.runId, streamUrl: run.streamUrl },
    });
  } catch (err) {
    console.error('/api/runs POST error:', err);
    return NextResponse.json(
      { ok: false, error: 'Failed to start run' },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest) {
  const runs = [...store.runs.values()].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  return NextResponse.json({ ok: true, data: runs });
}
