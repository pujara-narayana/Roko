'use client';

import { useEffect, useState } from 'react';
import type { AcceptanceRequirements, Bounty, Escrow } from '@/lib/types';
import { useRunStream } from '@/lib/client/useRunStream';
import { useElapsed } from '@/lib/client/useElapsed';
import { Card, CategoryBadge, AlertBar, EmptyCard } from '@/components/ui';
import { categoryColor } from '@/lib/client/constants';
import { usd, elapsedLabel, cleanText } from '@/lib/client/format';
import { StageIndicator } from './StageIndicator';
import { RequirementsBlock } from './RequirementsBlock';
import { AgentCard } from './AgentCard';
import { VerdictCard } from './VerdictCard';
import { SettlementPanel } from './SettlementPanel';

const AGENT_NAMES: Record<string, string> = {
  'agent-alpha': 'Agent Alpha',
  'agent-beta': 'Agent Beta',
  'agent-charlie': 'Agent Charlie',
};

const STAGE_HEADERS: Record<string, { label: string; desc: string; duration: string }> = {
  intake: { label: 'POST', desc: 'Intake agent compiles the brief into checkable acceptance requirements.', duration: '~10s' },
  compete: { label: 'COMPETE', desc: 'Three agents retrieve and submit results in parallel.', duration: '~90s' },
  verify: { label: 'VERIFY', desc: 'The oracle scores each submission against the locked criteria.', duration: '~60s' },
  settle: { label: 'SETTLE', desc: 'Escrow auto-releases to the winner — or returns to the poster.', duration: '~10s' },
};

function agentName(id: string) { return AGENT_NAMES[id] ?? id; }

export function RunView({
  bounty, requirements, escrow,
}: {
  bounty: Bounty;
  requirements: AcceptanceRequirements;
  escrow?: Escrow | null;
}) {
  const run = useRunStream(bounty.bountyId);
  const [autoStarted, setAutoStarted] = useState(false);

  // Timer reflects real pipeline time: start only once the run has actually
  // started (runId received from POST), not on the click before it resolves.
  const running = !!run.runId && !run.complete && !run.error;
  const elapsed = useElapsed(running, run.complete || !!run.error);

  // Auto-start the demo on mount (gated behind reduced-motion preference:
  // when reduce is set, the user starts it manually so nothing animates
  // without intent).
  useEffect(() => {
    if (autoStarted) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) {
      setAutoStarted(true);
      run.start();
    }
  }, [autoStarted, run]);

  const color = categoryColor(bounty.category);
  const amount = run.escrowAmount ?? escrow?.amountUsd ?? bounty.reward;

  // Escrow status label progression.
  const escrowStatusLabel = run.settlement?.action === 'release' && run.settlement.transactionId
    ? `Settled — ${usd(amount)}`
    : run.escrowFunded || escrow ? 'Funded' : 'Pending';
  const escrowStatusColor = escrowStatusLabel.startsWith('Settled') ? 'var(--paint-cyan)' : 'var(--paint-orange)';

  const winnerName = run.settlement?.winnerAgentId ? agentName(run.settlement.winnerAgentId) : undefined;
  const released = run.settlement?.action === 'release' && !!run.settlement.transactionId;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      {/* Connection status bars */}
      {run.connection === 'reconnecting' && (
        <div className="mb-4"><AlertBar tone="blue"><span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'var(--paint-blue)' }} /> Reconnecting…</AlertBar></div>
      )}
      {run.connection === 'polling' && !run.complete && (
        <div className="mb-4"><AlertBar tone="blue">Streaming via polling fallback…</AlertBar></div>
      )}
      {run.error && (
        <div className="mb-4"><AlertBar tone="danger">Connection lost — {cleanText(run.error)}. Showing last known state.</AlertBar></div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* ── LEFT RAIL (sticky) ── */}
        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-20 space-y-4">
            <Card className="p-5" style={{ background: 'var(--ink-800)' }}>
              <div className="flex items-center gap-2">
                <CategoryBadge category={bounty.category} color={color} />
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'var(--gradient-cta)', color: '#fff' }}>
                  Hero Bounty
                </span>
              </div>
              <h1 className="mt-3 font-display text-[22px] font-bold leading-tight" style={{ color: 'var(--fg)' }}>
                {bounty.title}
              </h1>

              <div className="mt-4">
                <RequirementsBlock req={requirements} compiling={run.stages.intake === 'active'} />
              </div>

              {/* Escrow badge */}
              <div className="mt-4 flex items-center justify-between rounded-xl p-3" style={{ background: 'var(--ink-900)' }}>
                <span className="font-mono text-base font-semibold" style={{ color: 'var(--paint-orange)' }}>
                  {usd(amount)} in escrow
                </span>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{ background: `color-mix(in srgb, ${escrowStatusColor} 16%, transparent)`, color: escrowStatusColor }}
                >
                  {escrowStatusLabel}
                </span>
              </div>

              {/* Stage indicator */}
              <div className="mt-4">
                <StageIndicator stages={run.stages} />
              </div>
            </Card>

            <p className="px-1 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
              {run.complete ? `${elapsedLabel(elapsed)} total` : `${elapsedLabel(elapsed)} elapsed`}
            </p>
          </div>
        </aside>

        {/* ── MAIN CANVAS ── */}
        <main className="lg:col-span-8 space-y-5">
          {/* Pipeline header */}
          <PipelineHeader run={run} />

          {/* Not started yet (reduced-motion / pre-start) */}
          {!run.started && (
            <Card className="flex flex-col items-center gap-4 p-12 text-center" style={{ background: 'var(--ink-800)' }}>
              <p className="font-display text-xl" style={{ color: 'var(--fg)' }}>Ready to run the pipeline</p>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Post → Compete → Verify → Settle, end to end.</p>
              <button onClick={run.start} className="btn-cta px-6 py-3 text-sm font-semibold">Start Demo Run →</button>
            </Card>
          )}

          {/* POST stage accordion (once complete) */}
          {run.stages.intake === 'complete' && (
            <StageAccordion title="POST — Requirements compiled">
              <RequirementsBlock req={requirements} />
            </StageAccordion>
          )}

          {/* COMPETE stage */}
          {run.agentOrder.length > 0 && (
            <section aria-label="Agent competition">
              <SectionLabel>Competing agents</SectionLabel>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {run.agentOrder.map((id, i) => (
                  <AgentCard key={id} agent={run.agents[id]} name={agentName(id)} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* VERIFY stage */}
          {(run.oracleRunning || run.verdictOrder.length > 0) && (
            <section aria-label="Oracle verification">
              <div
                className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${run.oracleRunning && !run.complete ? 'pulse-magenta' : ''}`}
                style={{ background: 'color-mix(in srgb, var(--paint-magenta) 14%, transparent)', color: 'var(--paint-magenta)' }}
                aria-live="polite"
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: 'var(--paint-magenta)' }} aria-hidden="true" />
                {run.oracleRunning && !run.complete
                  ? (run.oracleChecking ? `Verification Oracle — checking ${agentName(run.oracleChecking)}…` : 'Verification Oracle — running')
                  : 'Verification Oracle — complete'}
              </div>
              <div className="space-y-4">
                {run.verdictOrder.map((id, i) => (
                  <VerdictCard
                    key={id}
                    verdict={run.verdicts[id]}
                    agentName={agentName(id)}
                    index={i}
                    escrowReleased={released && run.settlement?.winnerAgentId === id ? { amountUsd: amount } : null}
                  />
                ))}
              </div>
            </section>
          )}

          {/* SETTLE stage */}
          {run.settlement && (
            <section aria-live="assertive" aria-label="Settlement">
              <SettlementPanel
                settlement={run.settlement}
                winnerName={winnerName}
                leaderboard={run.leaderboard}
                complete={run.complete}
              />
            </section>
          )}

          {/* Empty fixture guard */}
          {run.started && run.connection === 'error' && run.agentOrder.length === 0 && (
            <EmptyCard title="No run data available" subtitle="The pipeline did not return events. The bounty details remain in the left rail." />
          )}
        </main>
      </div>
    </div>
  );
}

function PipelineHeader({ run }: { run: ReturnType<typeof useRunStream> }) {
  const key = run.complete ? 'settle' : run.activeStage ?? 'intake';
  const h = STAGE_HEADERS[key] ?? STAGE_HEADERS.intake;
  return (
    <Card className="flex items-center justify-between p-5" style={{ background: 'var(--ink-800)' }}>
      <div>
        <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }} aria-live="polite">
          {run.complete ? 'PIPELINE COMPLETE' : h.label}
        </h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{h.desc}</p>
      </div>
      {!run.complete && (
        <span className="rounded-full px-3 py-1 font-mono text-xs" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>
          {h.duration}
        </span>
      )}
    </Card>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{children}</p>;
}

function StageAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass rounded-[var(--radius-card)] overflow-hidden" style={{ background: 'var(--ink-800)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${open ? 'Collapse' : 'Expand'} POST stage`}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          <span style={{ color: 'var(--paint-cyan)' }} aria-hidden="true">✓</span>
          {title}
        </span>
        <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5 anim-fade-in">{children}</div>}
    </div>
  );
}
