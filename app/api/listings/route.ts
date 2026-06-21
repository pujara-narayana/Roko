/**
 * GET /api/listings — seeded task template catalog
 */

import { NextResponse } from 'next/server';
import { SEED_LISTINGS } from '@/lib/seed/fixtures';

export async function GET() {
  return NextResponse.json({ ok: true, data: SEED_LISTINGS });
}
