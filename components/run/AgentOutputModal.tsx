'use client';

import { useEffect } from 'react';
import type { CompanyRecord, GenericDeliverable } from '@/lib/types';
import { usd, cleanText } from '@/lib/client/format';

export function AgentOutputModal({
  open, onClose, agentName, source, records, deliverable,
}: {
  open: boolean;
  onClose: () => void;
  agentName: string;
  source?: string;
  records?: CompanyRecord[];
  deliverable?: GenericDeliverable;
}) {
  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const hasRecords = !!records && records.length > 0;
  const sourceLabel = source === 'browserbase' ? 'live · Browserbase'
    : source === 'claude' ? 'generated · Claude'
    : source?.startsWith('seeded') ? 'seeded'
    : source;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end anim-fade-in"
      style={{ background: 'rgba(7,6,13,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${agentName} submitted output`}
    >
      <div
        className="glass h-full w-full max-w-[720px] overflow-y-auto p-6"
        style={{ background: 'rgba(13,11,26,0.96)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-bold" style={{ color: 'var(--fg)' }}>{agentName}</p>
            <p className="mt-0.5 font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
              {hasRecords ? `${records!.length} records submitted` : 'submitted deliverable'}
              {sourceLabel ? ` · ${sourceLabel}` : ''}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close output" className="text-xl" style={{ color: 'var(--fg-muted)' }}>✕</button>
        </div>

        {hasRecords ? (
          <RecordsTable records={records!} />
        ) : deliverable ? (
          <DeliverableView deliverable={deliverable} />
        ) : (
          <p className="rounded-xl p-4 text-sm" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>
            This agent did not produce any output.
          </p>
        )}
      </div>
    </div>
  );
}

function RecordsTable({ records }: { records: CompanyRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border)' }}>
      <table className="w-full border-collapse text-left text-[12.5px]">
        <thead>
          <tr style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">#</th>
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Company</th>
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Sector</th>
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">Geo</th>
            <th className="px-3 py-2 text-right font-mono text-[10px] uppercase tracking-wider">Revenue</th>
            <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider">VP-Eng email</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r, i) => (
            <tr key={r.id ?? i} style={{ borderTop: '1px solid var(--border)', color: 'var(--fg)' }}>
              <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>{i + 1}</td>
              <td className="px-3 py-2 font-medium">
                {cleanText(r.name)}
                {r.website && <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{r.website}</span>}
              </td>
              <td className="px-3 py-2" style={{ color: 'var(--fg-muted)' }}>{cleanText(r.sector)}</td>
              <td className="px-3 py-2" style={{ color: 'var(--fg-muted)' }}>{cleanText(r.geo)}</td>
              <td className="px-3 py-2 text-right font-mono" style={{ color: 'var(--paint-cyan)' }}>{usd(r.revenue)}</td>
              <td className="px-3 py-2 font-mono text-[11px]" style={{ color: 'var(--fg)' }}>{cleanText(r.vpEngEmail)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DeliverableView({ deliverable }: { deliverable: GenericDeliverable }) {
  const { kind, title, summary, body, artifactUrl, previewUrl, awaitingKey } = deliverable;
  const media = previewUrl || artifactUrl;
  return (
    <div className="space-y-4">
      <div>
        <p className="font-display text-base font-semibold" style={{ color: 'var(--fg)' }}>{cleanText(title)}</p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{kind}</p>
      </div>

      {summary && (
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{cleanText(summary)}</p>
      )}

      {awaitingKey && (
        <p className="rounded-xl p-3 text-sm font-medium" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}>
          🔑 Nothing generated — waiting on the {awaitingKey} API key.
        </p>
      )}

      {(kind === 'image' || kind === 'video') && media && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media} alt={title} className="w-full rounded-xl" style={{ border: '1px solid var(--border)' }} />
      )}

      {body && (
        <pre
          className="overflow-x-auto rounded-xl p-4 font-mono text-[12px] leading-relaxed"
          style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}
        >
          {cleanText(body)}
        </pre>
      )}
    </div>
  );
}
