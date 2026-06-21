import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { NavBar } from '@/components/NavBar';
import { RunView } from '@/components/run/RunView';
import { HERO_REQUIREMENTS } from '@/lib/seed/fixtures';
import type { AcceptanceRequirements } from '@/lib/types';
import type { BountyDetail } from '@/lib/client/api';

export const dynamic = 'force-dynamic';

async function fetchDetail(id: string): Promise<BountyDetail | null> {
  const h = await headers();
  const host = h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? 'http';
  try {
    const res = await fetch(`${proto}://${host}/api/bounties/${id}`, { cache: 'no-store' });
    const body = await res.json();
    if (!body.ok) return null;
    return body.data as BountyDetail;
  } catch {
    return null;
  }
}

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchDetail(id);
  if (!detail) notFound();

  const requirements: AcceptanceRequirements =
    detail.bounty.requirements ?? HERO_REQUIREMENTS;

  return (
    <>
      <NavBar />
      <RunView bounty={detail.bounty} requirements={requirements} escrow={detail.escrow} />
    </>
  );
}
