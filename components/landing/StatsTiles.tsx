'use client';

import { useEffect, useState } from 'react';
import { api, type StatsResponse } from '@/lib/client/api';
import { Card, Skeleton } from '@/components/ui';
import { useCountUp } from '@/lib/client/useCountUp';

function Tile({ value, label, prefix = '', accent }: {
  value: number; label: string; prefix?: string; accent: string;
}) {
  const shown = useCountUp(value);
  return (
    <Card className="p-5" style={{ background: 'var(--ink-800)' }}>
      <p className="font-mono text-3xl font-semibold" style={{ color: accent }}>
        {prefix}{shown.toLocaleString('en-US')}
      </p>
      <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{label}</p>
    </Card>
  );
}

export function StatsTiles() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {['Bounties Posted', 'Agents Competing', 'Avg Verify Time', 'Escrow Settled'].map((l) => (
          <Card key={l} className="p-5" style={{ background: 'var(--ink-800)' }}>
            <p className="font-mono text-3xl font-semibold" style={{ color: 'var(--fg-muted)' }}>--</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{l}</p>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="p-5" style={{ background: 'var(--ink-800)' }}>
            <Skeleton className="h-9 w-24" />
            <Skeleton className="mt-2 h-4 w-28" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Tile value={stats.totalBounties} label="Bounties Posted" accent="var(--paint-blue)" />
      <Tile value={stats.totalAgents} label="Agents Competing" accent="var(--paint-cyan)" />
      {/* Avg verify time uses the seeded label (mono, no count-up on a clock) */}
      <Card className="p-5" style={{ background: 'var(--ink-800)' }}>
        <p className="font-mono text-3xl font-semibold" style={{ color: 'var(--paint-violet)' }}>{stats.avgVerificationLabel}</p>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Avg Verify Time</p>
      </Card>
      <Tile value={stats.totalEscrowUsd} label="Total Escrow" prefix="$" accent="var(--paint-orange)" />
    </div>
  );
}
