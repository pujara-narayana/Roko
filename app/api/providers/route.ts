/**
 * GET /api/providers — which external engines are wired vs. awaiting a key.
 * Client uses this to pre-warn before posting a bounty to an agent whose
 * provider isn't configured yet.
 */

import { NextResponse } from 'next/server';
import { getProviderStatuses } from '@/lib/providers';

export async function GET() {
  return NextResponse.json({ ok: true, data: getProviderStatuses() });
}
