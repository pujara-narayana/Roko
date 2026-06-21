'use client';

import Link from 'next/link';
import type { SettlementState } from '@/lib/client/useRunStream';
import { usd } from '@/lib/client/format';

export function SettlementPanel({
  settlement, winnerName, leaderboard, complete,
}: {
  settlement: SettlementState;
  winnerName?: string;
  leaderboard?: Array<{ agentId: string; name: string; reputationScore: number }>;
  complete: boolean;
}) {
  const released = settlement.action === 'release';
  const accent = released ? 'var(--paint-cyan)' : 'var(--warn)';
  const winnerRank = leaderboard?.findIndex((a) => a.agentId === settlement.winnerAgentId);
  // A win always adds reputation, so the agent climbed unless already at #1.
  const climbed = winnerRank != null && winnerRank > 0;

  return (
    <div className={`glass anim-slide-up rounded-[var(--radius-card)] p-6 ${released ? 'glow-cyan' : ''}`} style={{ background: 'var(--ink-800)' }}>
      {/* Fund-flow icon */}
      <div className="relative mb-4 flex items-center gap-3">
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: 'color-mix(in srgb, var(--paint-orange) 18%, transparent)' }}
          aria-hidden="true"
        >
          💰
        </span>
        <span className="font-mono text-xl" style={{ color: accent }} aria-hidden="true">→</span>
        <span
          className="flex h-12 w-12 items-center justify-center rounded-full text-xl"
          style={{ background: `color-mix(in srgb, ${accent} 18%, transparent)`, color: accent }}
          aria-hidden="true"
        >
          {released ? '✓' : '↩'}
        </span>
      </div>

      <h3 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>
        {released
          ? `Escrow released to ${winnerName ?? settlement.winnerAgentId}`
          : `No passing submission — escrow returned to poster`}
      </h3>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {settlement.amountUsd != null && (
          <span className="font-mono text-lg font-semibold" style={{ color: accent }}>
            {usd(settlement.amountUsd)}
          </span>
        )}
        {settlement.transactionId && (
          <span className="rounded-full px-2.5 py-1 font-mono text-[11px]" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>
            {settlement.transactionId}
          </span>
        )}
      </div>

      {/* Leaderboard delta */}
      {released && winnerRank != null && winnerRank >= 0 && (
        <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--ink-900)' }}>
          <p className="text-sm" style={{ color: 'var(--fg)' }}>
            <span className="font-semibold">{winnerName}</span>
            {' '}now ranked{' '}
            <span className="font-mono font-bold" style={{ color: 'var(--paint-cyan)' }}>
              #{winnerRank + 1}
              {climbed && (
                <span style={{ color: 'var(--paint-orange)' }} aria-label="moved up after this win">{' ▲'}</span>
              )}
            </span>
            {' '}on the leaderboard
          </p>
        </div>
      )}

      {/* Post-settle CTAs */}
      {complete && (
        <div className="mt-5 flex flex-wrap gap-3 anim-fade-in">
          <Link href="/leaderboard" className="btn-cta px-5 py-2.5 text-sm font-semibold">
            View Leaderboard
          </Link>
          <Link
            href="/browse"
            className="rounded-full px-5 py-2.5 text-sm font-semibold"
            style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
          >
            Browse More Bounties
          </Link>
        </div>
      )}
    </div>
  );
}
