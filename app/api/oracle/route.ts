/**
 * POST /api/oracle/verify — manual oracle trigger (for testing)
 * Body: { bountyId, submissionIds[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { seedStore } from '@/lib/seed/init';
import store from '@/lib/store';
import { runOracle } from '@/lib/oracle';
import { HERO_REQUIREMENTS } from '@/lib/seed/fixtures';

seedStore();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { bountyId, submissionIds } = body as {
      bountyId: string;
      submissionIds?: string[];
    };

    if (!bountyId) {
      return NextResponse.json({ ok: false, error: 'bountyId required' }, { status: 400 });
    }

    const bounty = store.getBounty(bountyId);
    if (!bounty) {
      return NextResponse.json({ ok: false, error: 'Bounty not found' }, { status: 404 });
    }

    // Get submissions for this bounty
    let submissions = [...store.submissions.values()].filter(
      s => s.bountyId === bountyId && s.status === 'submitted'
    );
    if (submissionIds && submissionIds.length > 0) {
      submissions = submissions.filter(s => submissionIds.includes(s.submissionId));
    }

    if (submissions.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No valid submissions found for this bounty' },
        { status: 400 }
      );
    }

    const requirements = bounty.requirements ?? HERO_REQUIREMENTS;
    const batchResult = await runOracle(bountyId, 'manual', submissions, requirements);
    store.setOracleBatch(batchResult);

    return NextResponse.json({ ok: true, data: batchResult });
  } catch (err) {
    console.error('/api/oracle POST error:', err);
    return NextResponse.json({ ok: false, error: 'Oracle error' }, { status: 500 });
  }
}
