import Link from 'next/link';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { Card, CategoryBadge, StatusBadge } from '@/components/ui';
import { RequirementsBlock } from '@/components/run/RequirementsBlock';
import { categoryColor } from '@/lib/client/constants';
import { usd, relativeTime } from '@/lib/client/format';
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

export default async function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await fetchDetail(id);
  if (!detail) notFound();

  const { bounty, escrow } = detail;
  const color = categoryColor(bounty.category);

  // Map internal escrow enum to audience-facing words.
  const ESCROW_LABELS: Record<string, string> = { held: 'Funded', released: 'Released', returned: 'Returned' };
  const escrowLabel = escrow ? (ESCROW_LABELS[escrow.status] ?? escrow.status) : 'pending';

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <Link href="/browse" className="mb-6 inline-block text-sm font-medium" style={{ color: 'var(--paint-blue)' }}>
          ← Back to Browse
        </Link>

        <Card className="p-7" style={{ background: 'var(--ink-800)' }}>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={bounty.category} color={color} />
            <StatusBadge status={bounty.status} />
          </div>
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight" style={{ color: 'var(--fg)' }}>
            {bounty.title}
          </h1>
          <p className="mt-3 text-base leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
            {bounty.description}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Reward" value={usd(bounty.reward)} accent="var(--paint-cyan)" />
            <Stat label="Escrow" value={escrowLabel} accent="var(--paint-orange)" />
            <Stat label="Posted" value={relativeTime(bounty.createdAt)} accent="var(--fg)" />
          </div>

          {bounty.requirements && (
            <div className="mt-6">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
                Acceptance requirements
              </p>
              <RequirementsBlock req={bounty.requirements} />
            </div>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={`/run/${bounty.bountyId}`} className="btn-cta px-6 py-3 text-sm font-semibold">
              Run This Bounty →
            </Link>
            <Link href="/leaderboard" className="rounded-full px-6 py-3 text-sm font-semibold" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
              See Competing Agents
            </Link>
          </div>
        </Card>
      </main>
      <Footer />
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--ink-900)' }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      <p className="mt-1 font-mono text-base font-semibold" style={{ color: accent }}>{value}</p>
    </div>
  );
}
