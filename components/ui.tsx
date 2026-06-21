'use client';

import type { ReactNode } from 'react';

// ─── Glass card shell ─────────────────────────
export function Card({
  children, className = '', glow, style, hover = false, ...rest
}: {
  children: ReactNode;
  className?: string;
  glow?: 'cyan' | 'orange' | 'magenta' | 'blue';
  hover?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const glowClass = glow ? `glow-${glow}` : '';
  return (
    <div
      className={`glass rounded-[var(--radius-card)] ${hover ? 'card-hover' : ''} ${glowClass} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
}

// ─── Category badge (pill) ────────────────────
export function CategoryBadge({ category, color }: { category: string; color: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 35%, transparent)` }}
    >
      {category}
    </span>
  );
}

// ─── Status badge (bounty / escrow) ───────────
const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'var(--paint-blue)' },
  in_progress: { label: 'In Progress', color: 'var(--warn)' },
  settled: { label: 'Settled', color: 'var(--paint-cyan)' },
  failed: { label: 'Failed', color: 'var(--danger)' },
  held: { label: 'Funded', color: 'var(--paint-orange)' },
  funded: { label: 'Funded', color: 'var(--paint-orange)' },
  released: { label: 'Released', color: 'var(--paint-cyan)' },
  returned: { label: 'Returned', color: 'var(--warn)' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { label: status, color: 'var(--fg-muted)' };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  );
}

// ─── Skeleton block ───────────────────────────
export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

// ─── Inline alert bar ─────────────────────────
export function AlertBar({ tone = 'warn', children }: { tone?: 'warn' | 'blue' | 'danger'; children: ReactNode }) {
  const color = tone === 'warn' ? 'var(--warn)' : tone === 'danger' ? 'var(--danger)' : 'var(--paint-blue)';
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 30%, transparent)` }}
    >
      {children}
    </div>
  );
}

// ─── Empty / ghost card ───────────────────────
export function EmptyCard({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed px-8 py-16 text-center"
      style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.02)' }}
    >
      <p className="font-display text-lg" style={{ color: 'var(--fg)' }}>{title}</p>
      {subtitle && <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>{subtitle}</p>}
    </div>
  );
}
