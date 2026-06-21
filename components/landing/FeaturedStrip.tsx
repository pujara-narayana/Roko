'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Bounty } from '@/lib/types';
import { api } from '@/lib/client/api';
import { BountyCard } from '@/components/BountyCard';
import { Card, Skeleton } from '@/components/ui';

export function FeaturedStrip() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getBounties().then(setBounties).catch(() => setError(true));
  }, []);

  return (
    <section className="mx-auto max-w-7xl px-6 py-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>Featured bounties</h2>
        <Link href="/browse" className="text-sm font-semibold" style={{ color: 'var(--paint-blue)' }}>Browse all →</Link>
      </div>

      {error && !bounties && (
        <Card className="p-8 text-center" style={{ background: 'var(--ink-800)' }}>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Couldn&apos;t load bounties right now.</p>
        </Card>
      )}

      {!bounties && !error && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="min-h-[200px] p-5" style={{ background: 'var(--ink-800)' }}>
              <Skeleton className="h-5 w-24" /><Skeleton className="mt-3 h-6 w-40" /><Skeleton className="mt-3 h-12 w-full" />
            </Card>
          ))}
        </div>
      )}

      {bounties && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {bounties.slice(0, 3).map((b, i) => <BountyCard key={b.bountyId} bounty={b} index={i} />)}
        </div>
      )}
    </section>
  );
}
