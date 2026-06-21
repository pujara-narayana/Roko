/**
 * GET /api/runs/:runId — get run state + all events
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';

seedStore();

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
  const run = store.getRun(runId);
  if (!run) {
    return NextResponse.json({ ok: false, error: 'Run not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: run });
}
