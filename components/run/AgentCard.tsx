'use client';

import type { AgentCardState, AgentStatus } from '@/lib/client/useRunStream';
import { agentAccent, agentInitials } from '@/lib/client/constants';
import { cleanText } from '@/lib/client/format';

const STATUS_META: Record<AgentStatus, { label: string; color: string; symbol: string }> = {
  queued: { label: 'Queued', color: 'var(--fg-muted)', symbol: '○' },
  working: { label: 'Working…', color: 'var(--paint-blue)', symbol: '◉' },
  submitted: { label: 'Submitted', color: 'var(--paint-cyan)', symbol: '✓' },
  failed: { label: 'Failed', color: 'var(--danger)', symbol: '✗' },
};

export function AgentCard({
  agent, name, index = 0,
}: { agent: AgentCardState; name: string; index?: number }) {
  const [c1, c2] = agentAccent(agent.agentId);
  const meta = STATUS_META[agent.status];
  const working = agent.status === 'working';

  return (
    <div
      className="glass anim-slide-up flex flex-col gap-3 rounded-[var(--radius-card)] p-4"
      style={{
        background: 'var(--ink-800)',
        animationDelay: `${Math.min(index, 5) * 40}ms`,
        borderColor: working ? 'color-mix(in srgb, var(--paint-blue) 40%, transparent)' : undefined,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${working ? 'pulse-blue' : ''}`}
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, color: '#fff' }}
          aria-hidden="true"
        >
          {agentInitials(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: 'var(--fg)' }}>{name}</p>
          <p className="truncate font-mono text-[10px]" style={{ color: 'var(--fg-muted)' }}>{agent.agentId}</p>
        </div>
      </div>

      {/* Status pill */}
      <div
        className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors"
        style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}
      >
        <span aria-hidden="true">{meta.symbol}</span>
        {meta.label}
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full" style={{ background: 'var(--ink-700)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${(agent.progressStep / Math.max(1, agent.totalSteps)) * 100}%`,
            background: agent.status === 'submitted' ? 'var(--paint-cyan)' : agent.status === 'failed' ? 'var(--danger)' : 'var(--paint-blue)',
          }}
        />
      </div>

      {/* Live log */}
      <div
        aria-live="polite"
        className="h-[68px] overflow-hidden rounded-lg p-2 font-mono text-[10.5px] leading-snug"
        style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}
      >
        {agent.logLines.length === 0 ? (
          <span style={{ opacity: 0.5 }}>waiting…</span>
        ) : (
          agent.logLines.slice(-4).map((line, i, arr) => (
            <div key={i} style={{ opacity: i === arr.length - 1 ? 1 : 0.5 }}>
              {cleanText(line)}
            </div>
          ))
        )}
      </div>

      {/* Result preview */}
      {agent.status === 'submitted' && agent.recordCount != null && (
        <p className="font-mono text-xs" style={{ color: 'var(--paint-cyan)' }}>
          {agent.recordCount} results submitted
        </p>
      )}
    </div>
  );
}
