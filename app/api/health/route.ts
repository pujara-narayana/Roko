/**
 * GET /api/health — health check
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      status: 'healthy',
      ts: new Date().toISOString(),
      version: '1.0.0',
      store: 'in-memory',
      redis: process.env.REDIS_URL ? 'connected' : 'fallback',
      browserbase: process.env.BROWSERBASE_API_KEY ? 'configured' : 'seeded-cache',
    },
  });
}
