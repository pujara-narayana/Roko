/**
 * GET /api/runs/:runId/events?after=<seq>
 *
 * Polling fallback when SSE is not available.
 * Returns all events with seq > after (monotonic, deduped).
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const { searchParams } = new URL(req.url);
  const afterSeq = parseInt(searchParams.get('after') ?? '0', 10);

  const run = store.getRun(runId);
  if (!run) {
    return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
  }

  const events = run.events.filter(e => e.seq > afterSeq);

  return NextResponse.json(
    {
      ok: true,
      data: {
        runId,
        runStatus: run.status,
        events,
        lastSeq: run.events.at(-1)?.seq ?? 0,
      },
    },
    {
      headers: { 'Cache-Control': 'no-cache' },
    }
  );
}
