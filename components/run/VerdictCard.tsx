'use client';

import { useState } from 'react';
import type { VerdictState } from '@/lib/client/useRunStream';
import { cleanText, usd } from '@/lib/client/format';

// Sub-scores ALWAYS render in this fixed order (locked contract).
const SUBSCORE_ORDER: { key: 'criteriaMatch' | 'completeness' | 'validity'; label: string }[] = [
  { key: 'criteriaMatch', label: 'criteriaMatch' },
  { key: 'completeness', label: 'completeness' },
  { key: 'validity', label: 'validity' },
];

function barColor(value: number): string {
  if (value >= 90) return 'var(--paint-cyan)';
  if (value >= 70) return 'var(--warn)';
  return 'var(--danger)';
}

function SubScoreBar({ label, value }: { label: string; value: number }) {
  const color = barColor(value);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--ink-700)' }}>
        <div className="anim-bar h-full rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold" style={{ color }}>{value}%</span>
    </div>
  );
}

export function VerdictCard({
  verdict, agentName, index = 0, escrowReleased,
}: {
  verdict: VerdictState;
  agentName: string;
  index?: number;
  escrowReleased?: { amountUsd: number } | null;
}) {
  const pass = verdict.verdict === 'pass';
  const badgeColor = pass ? 'var(--paint-cyan)' : 'var(--danger)';

  // Collapse long reason lists: show first 3, expand for the rest.
  const REASON_PREVIEW = 3;
  const [showAll, setShowAll] = useState(false);
  const hiddenCount = verdict.reasons.length - REASON_PREVIEW;
  const visibleReasons = showAll ? verdict.reasons : verdict.reasons.slice(0, REASON_PREVIEW);

  return (
    <div
      className={`glass anim-slide-up rounded-[var(--radius-card)] p-5 ${pass ? 'glow-cyan' : ''}`}
      style={{
        background: 'var(--ink-800)',
        animationDelay: `${Math.min(index, 5) * 60}ms`,
        borderColor: `color-mix(in srgb, ${badgeColor} 35%, transparent)`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>{agentName}</p>
          <p className="font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>
            overall {verdict.overallScore}% · {verdict.duplicates} duplicates
          </p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-sm font-bold tracking-wide"
          style={{ background: badgeColor, color: '#07060D' }}
          aria-label={`Verdict for ${agentName}: ${pass ? 'PASS' : 'FAIL'}`}
        >
          {pass ? 'PASS' : 'FAIL'}
        </span>
      </div>

      {/* Sub-scores — always in order */}
      <div className="mt-4 space-y-2.5">
        {SUBSCORE_ORDER.map((s) => (
          <SubScoreBar key={s.key} label={s.label} value={verdict.subScores[s.key]} />
        ))}
      </div>

      {/* Summary */}
      <p className="mt-4 text-[13px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
        {cleanText(verdict.summary)}
      </p>

      {/* Itemized reasons */}
      <div className="mt-3 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
        <p className="mb-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
          Oracle reasons
        </p>
        <ul className="space-y-2">
          {visibleReasons.map((r, i) => (
            <li key={i} className="flex gap-2 text-[13px]">
              <span
                className="mt-0.5 shrink-0 font-bold"
                style={{ color: r.ok ? 'var(--paint-cyan)' : 'var(--danger)' }}
                aria-hidden="true"
              >
                {r.ok ? '✓' : '✗'}
              </span>
              <div className="min-w-0">
                <span style={{ color: r.ok ? 'var(--fg)' : 'var(--fg)' }}>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>{r.kind}</span>
                  {' — '}
                  {cleanText(r.detail)}
                </span>
                {r.failingRows && r.failingRows.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-2 font-mono text-[10.5px]" style={{ color: 'var(--danger)' }}>
                    {r.failingRows.slice(0, 5).map((row, j) => (
                      <li key={j}>· {cleanText(row)}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ul>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            className="mt-2 font-mono text-[11px] font-semibold"
            style={{ color: 'var(--paint-blue)' }}
          >
            {showAll ? 'Show less' : `Show ${hiddenCount} more`}
          </button>
        )}
      </div>

      {/* Escrow release confirmation (winner only) */}
      {pass && escrowReleased && (
        <div
          className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold"
          style={{ background: 'color-mix(in srgb, var(--paint-cyan) 14%, transparent)', color: 'var(--paint-cyan)' }}
        >
          <span aria-hidden="true">⚡</span>
          Escrow released: <span className="font-mono">{usd(escrowReleased.amountUsd)} → {agentName}</span>
        </div>
      )}
    </div>
  );
}
