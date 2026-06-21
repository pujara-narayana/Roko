/**
 * GET /api/health — health check
 *
 * Redis status values:
 *   fallback    — REDIS_URL not set; using in-memory only
 *   configured  — REDIS_URL set, connection attempt in progress
 *   connected   — Redis connected and ready
 *   disconnected — Redis was connected but lost the connection
 */

import { NextResponse } from 'next/server';
import { getRedisStatus } from '@/lib/redis/client';

export async function GET() {
  const redisStatus = getRedisStatus();
  const redisUrl = process.env.REDIS_URL;

  return NextResponse.json({
    ok: true,
    data: {
      status: 'healthy',
      ts: new Date().toISOString(),
      version: '1.0.0',
      store: redisUrl ? 'in-memory+redis' : 'in-memory',
      redis: redisStatus,
      redisMode: redisUrl ? 'write-through' : 'disabled',
      browserbase: process.env.BROWSERBASE_API_KEY ? 'configured' : 'seeded-cache',
    },
  });
}
