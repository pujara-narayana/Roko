'use client';

import type { AcceptanceRequirements } from '@/lib/types';
import { usd } from '@/lib/client/format';

/** Requirements rendered JSON-adjacent as key:value rows (mono, cyan keys). */
export function RequirementsBlock({
  req, compiling = false,
}: { req: AcceptanceRequirements; compiling?: boolean }) {
  const rows: [string, string][] = [
    ['count', String(req.targetCount)],
    ['sector', req.sector],
    ['geo', req.geo],
    ['min_revenue', `${usd(req.minRevenue)} ARR`],
    ['required_fields', req.requiredFields.join(', ')],
    ['dedup', 'strict'],
  ];

  return (
    <div
      className="rounded-xl p-3.5 font-mono text-[12.5px] leading-relaxed"
      style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}
    >
      {compiling && (
        <div className="mb-2 flex items-center gap-2 text-[11px]" style={{ color: 'var(--paint-blue)' }}>
          <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--paint-blue)' }} />
          Compiling requirements…
        </div>
      )}
      <div className="space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <span style={{ color: 'var(--paint-cyan)' }}>{k}:</span>
            <span style={{ color: 'var(--fg)' }}>{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>criteria</span>
        <ul className="mt-1 space-y-1">
          {req.criteria.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span style={{ color: 'var(--paint-violet)' }}>·</span>
              <span style={{ color: 'var(--fg-muted)' }}>{c.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
