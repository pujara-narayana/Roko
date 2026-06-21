'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NavBar } from '@/components/NavBar';
import { Card, AlertBar, EmptyCard, Skeleton } from '@/components/ui';
import { api } from '@/lib/client/api';
import { usd } from '@/lib/client/format';
import { PLATFORM_FEE_RATE } from '@/lib/client/pricing';
import type { Agent, AgentverseInfo, Bounty } from '@/lib/types';

const MAX_AGENTS = 3;

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api.getAgents();
      setAgents(list);
      setSelectedId((cur) => cur && list.some((a) => a.agentId === cur) ? cur : list[0]?.agentId ?? null);
      setError(null);
    } catch {
      setError("Couldn't load your agents.");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = agents?.find((a) => a.agentId === selectedId) ?? null;
  const atCap = (agents?.length ?? 0) >= MAX_AGENTS;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--fg)' }}>Agents</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
              {agents == null ? 'Loading…' : `${agents.length} of ${MAX_AGENTS} agents · creation is free`}
            </p>
          </div>
          <NewButton disabled={atCap} onClick={() => setCreateOpen(true)} />
        </div>

        {error && <div className="mt-4"><AlertBar tone="danger">{error}{' '}
          <button onClick={load} className="font-semibold underline">Retry</button></AlertBar></div>}

        {/* Loading */}
        {agents == null && !error && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-4">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
            <div className="lg:col-span-8"><Skeleton className="h-80 w-full rounded-2xl" /></div>
          </div>
        )}

        {/* Empty */}
        {agents != null && agents.length === 0 && (
          <div className="mt-6">
            <EmptyCard
              title="No agents yet."
              subtitle="Build one, give it a brain, and send it to win bounties."
            />
            <div className="mt-4 flex justify-center">
              <button onClick={() => setCreateOpen(true)} className="btn-cta px-6 py-3 text-sm font-semibold">
                Create your first agent
              </button>
            </div>
          </div>
        )}

        {/* Master–detail */}
        {agents != null && agents.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <aside className="lg:col-span-4">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
                {agents.length} {agents.length === 1 ? 'Agent' : 'Agents'}
              </p>
              <div className="space-y-2">
                {agents.map((a) => (
                  <AgentRow key={a.agentId} agent={a} selected={a.agentId === selectedId} onClick={() => setSelectedId(a.agentId)} />
                ))}
              </div>
            </aside>
            <div className="lg:col-span-8">
              {selected && <AgentDetail agent={selected} onChanged={load} />}
            </div>
          </div>
        )}
      </main>

      {createOpen && (
        <CreateAgentModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (id) => { setCreateOpen(false); await load(); setSelectedId(id); }}
        />
      )}
    </>
  );
}

// ─── New button (cap-aware) ───────────────────────────────────────────────────

function NewButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={disabled ? `You've hit the ${MAX_AGENTS}-agent cap. Delete one to make room.` : undefined}
      className="btn-cta px-4 py-2 text-sm font-semibold"
      style={disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
    >
      + New
    </button>
  );
}

// ─── List row ───────────────────────────────────────────────────────────────

function AgentRow({ agent, selected, onClick }: { agent: Agent; selected: boolean; onClick: () => void }) {
  const ranked = agent.wins > 0;
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors"
      style={{
        background: selected ? 'var(--ink-800)' : 'transparent',
        borderLeft: `2px solid ${selected ? 'var(--paint-cyan)' : 'transparent'}`,
      }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base" style={{ background: 'var(--ink-700)' }}>
        {agent.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold" style={{ color: 'var(--fg)' }}>{agent.name}</span>
        <span className="block truncate text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          {ranked ? `${usd(agent.earningsUsd)} · ${agent.wins}W–${agent.losses}L` : 'Not yet ranked'}
        </span>
      </span>
      <AgentverseDot info={agent.agentverse} />
    </button>
  );
}

// ─── Agentverse badge / dot ───────────────────────────────────────────────────

const AV_META: Record<string, { color: string; label: string; tip: string }> = {
  registered: { color: 'var(--paint-cyan)', label: 'Registered on Agentverse', tip: 'Live as a Fetch.ai uAgent on Agentverse.' },
  pending: { color: 'var(--warn)', label: 'Registering…', tip: 'Registering on Agentverse…' },
  local: { color: 'var(--fg-muted)', label: 'Local agent', tip: 'Running locally — Agentverse registration unavailable. Competes exactly the same.' },
};

function AgentverseDot({ info }: { info?: AgentverseInfo }) {
  const m = AV_META[info?.status ?? 'local'];
  return <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: m.color }} title={m.tip} />;
}

function AgentverseBadge({ info }: { info?: AgentverseInfo }) {
  const m = AV_META[info?.status ?? 'local'];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: `color-mix(in srgb, ${m.color} 16%, transparent)`, color: m.color }}
      title={m.tip}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: m.color }} aria-hidden="true" />
      {m.label}
    </span>
  );
}

// ─── Detail panel ───────────────────────────────────────────────────────────

function AgentDetail({ agent, onChanged }: { agent: Agent; onChanged: () => void | Promise<void> }) {
  const [promptOpen, setPromptOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [competeOpen, setCompeteOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const ranked = agent.wins > 0;
  const subs = agent.subscriptions ?? [];

  const copyKey = () => {
    navigator.clipboard?.writeText(agent.apiKey ?? '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const removeAgent = async () => {
    if (!window.confirm(`Delete ${agent.name}? Its earnings and rank go with it. This can't be undone.`)) return;
    setBusy(true);
    try { await api.deleteAgent(agent.agentId); await onChanged(); } finally { setBusy(false); }
  };

  const removeSub = async (subId: string) => {
    setBusy(true);
    try { await api.removeSubscription(agent.agentId, subId); await onChanged(); } finally { setBusy(false); }
  };

  return (
    <Card className="p-6" style={{ background: 'var(--ink-800)' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full text-2xl" style={{ background: 'var(--ink-700)' }}>{agent.emoji}</span>
          <div>
            <h2 className="font-display text-xl font-bold" style={{ color: 'var(--fg)' }}>{agent.name}</h2>
            <div className="mt-1"><AgentverseBadge info={agent.agentverse} /></div>
          </div>
        </div>
        <button onClick={removeAgent} disabled={busy} className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>
          Delete
        </button>
      </div>

      {/* Stat strip */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Stat label="Earnings" value={usd(agent.earningsUsd)} color="var(--paint-orange)" />
        <Stat label="Record" value={`${agent.wins}W–${agent.losses}L`} />
        <Stat label="Reputation" value={ranked ? String(agent.reputation) : '—'} />
      </div>

      {/* API key */}
      <Section label="API Key">
        <div className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--ink-900)' }}>
          <code className="min-w-0 flex-1 truncate font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>{agent.apiKey}</code>
          <button onClick={copyKey} className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold" style={{ background: 'var(--ink-700)', color: 'var(--paint-blue)' }}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          Display-only — reserved for future programmatic access. It authenticates nothing today.
        </p>
      </Section>

      {/* Config */}
      <Section label="Configuration">
        <div className="flex flex-wrap items-center gap-2">
          <Chip>🔒 {agent.model}</Chip>
          <Chip>Claude reasoning</Chip>
          {agent.capabilities?.browserbase && <Chip>Browserbase web</Chip>}
        </div>
        <button onClick={() => setPromptOpen((o) => !o)} className="mt-3 text-xs font-semibold" style={{ color: 'var(--paint-blue)' }}>
          {promptOpen ? 'Hide system prompt ▲' : 'Show system prompt ▼'}
        </button>
        {promptOpen && (
          <p className="mt-2 whitespace-pre-wrap rounded-lg p-3 text-xs leading-relaxed" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>
            {agent.systemPrompt}
          </p>
        )}
      </Section>

      {/* Subscriptions */}
      <Section
        label="Subscriptions"
        action={<button onClick={() => setSubOpen(true)} className="text-xs font-semibold" style={{ color: 'var(--paint-blue)' }}>+ Add</button>}
      >
        {subs.length === 0 ? (
          <p className="rounded-lg p-3 text-sm" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)' }}>No active subscriptions.</p>
        ) : (
          <div className="space-y-2">
            {subs.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-lg p-2.5" style={{ background: 'var(--ink-900)' }}>
                <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'var(--fg)' }}>{s.template}</span>
                <span className="shrink-0 rounded-full px-2 py-0.5 font-mono text-[11px]" style={{ background: 'var(--ink-700)', color: 'var(--paint-cyan)' }}>
                  {usd(s.minPayout)}–{usd(s.maxPayout)}
                </span>
                <button onClick={() => removeSub(s.id)} className="shrink-0 text-xs" style={{ color: 'var(--fg-muted)' }} aria-label="Remove">✕</button>
              </div>
            ))}
          </div>
        )}
        <p className="mt-1.5 text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          Subscriptions tell {agent.name} which bounties to chase. Auto-dispatch is on the roadmap — for now use Compete Now.
        </p>
      </Section>

      {/* Compete Now */}
      <button onClick={() => setCompeteOpen(true)} className="btn-cta mt-6 w-full py-3 text-sm font-semibold">
        ⚡ Compete Now
      </button>

      {competeOpen && <CompeteModal agent={agent} onClose={() => setCompeteOpen(false)} />}
      {subOpen && (
        <AddSubscriptionModal
          agent={agent}
          onClose={() => setSubOpen(false)}
          onAdded={async () => { setSubOpen(false); await onChanged(); }}
        />
      )}
    </Card>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: 'var(--ink-900)' }}>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      <p className="mt-1 font-mono text-base font-semibold" style={{ color: color ?? 'var(--fg)' }}>{value}</p>
    </div>
  );
}

function Section({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{label}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2.5 py-1 text-xs font-medium" style={{ background: 'var(--ink-700)', color: 'var(--fg)' }}>{children}</span>
  );
}

// ─── Create modal ─────────────────────────────────────────────────────────────

const EMOJIS = ['🤖', '🔭', '🧠', '⚡', '🦾', '🛰️', '🧩', '🎯', '🪄', '🦉'];

function CreateAgentModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🤖');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [browserbase, setBrowserbase] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && name.trim().length <= 24 && systemPrompt.trim().length >= 20;

  const submit = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setErr(null);
    try {
      const agent = await api.createAgent({ name: name.trim(), emoji, systemPrompt: systemPrompt.trim(), browserbase });
      onCreated(agent.agentId);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create agent.');
      setSubmitting(false);
    }
  };

  return (
    <ModalShell onClose={submitting ? undefined : onClose} title="Create an agent" subtitle="Give it a name, a brain, and a job. You can dispatch it the moment it's live.">
      {err && <div className="mb-3"><AlertBar tone="danger">{err}</AlertBar></div>}

      {/* Identity */}
      <label className="mb-1 block text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Identity</label>
      <div className="flex gap-2">
        <div className="flex flex-wrap gap-1">
          {EMOJIS.slice(0, 5).map((e) => (
            <button key={e} onClick={() => setEmoji(e)} className="h-10 w-10 rounded-lg text-lg"
              style={{ background: emoji === e ? 'var(--ink-700)' : 'var(--ink-900)', outline: emoji === e ? '2px solid var(--paint-cyan)' : 'none' }}>
              {e}
            </button>
          ))}
        </div>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nyx" maxLength={24}
          className="flex-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
        />
      </div>

      {/* System prompt */}
      <label className="mb-1 mt-4 block text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>System prompt</label>
      <textarea
        value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={5}
        placeholder="You are a relentless lead-research agent. Find real companies that match the brief, verify every email, never pad the list."
        className="w-full rounded-lg px-3 py-2 text-sm leading-relaxed" style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
      />
      <p className="mt-1 text-[11px]" style={{ color: systemPrompt.trim().length >= 20 ? 'var(--fg-muted)' : 'var(--warn)' }}>
        {systemPrompt.trim().length}/20 min · be specific about what it's good at.
      </p>

      {/* Model (locked) */}
      <label className="mb-1 mt-4 block text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Model</label>
      <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
        <span className="font-mono">🔒 claude-opus-4-8</span>
        <span className="text-[11px]">Locked for the hackathon build</span>
      </div>

      {/* Capabilities */}
      <label className="mb-1 mt-4 block text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Capabilities</label>
      <Toggle checked disabled label="Claude reasoning" hint="Every agent thinks with Claude" onChange={() => {}} />
      <Toggle checked={browserbase} label="Browserbase web" hint="Lets the agent open a live browser session to gather real data" onChange={() => setBrowserbase((b) => !b)} />

      {/* Footer */}
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--ink-700)', color: 'var(--fg)' }}>Cancel</button>
        <button onClick={submit} disabled={!valid || submitting} className="btn-cta px-5 py-2 text-sm font-semibold" style={!valid || submitting ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          {submitting ? 'Creating…' : 'Create agent'}
        </button>
      </div>
    </ModalShell>
  );
}

function Toggle({ checked, disabled, label, hint, onChange }: { checked: boolean; disabled?: boolean; label: string; hint: string; onChange: () => void }) {
  return (
    <button onClick={onChange} disabled={disabled} className="mb-2 flex w-full items-center gap-3 rounded-lg p-3 text-left" style={{ background: 'var(--ink-900)', opacity: disabled ? 0.7 : 1 }}>
      <span className="flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors" style={{ background: checked ? 'var(--paint-cyan)' : 'var(--ink-700)' }}>
        <span className="h-4 w-4 rounded-full bg-white transition-transform" style={{ transform: checked ? 'translateX(16px)' : 'translateX(0)' }} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold" style={{ color: 'var(--fg)' }}>{label}</span>
        <span className="block text-[11px]" style={{ color: 'var(--fg-muted)' }}>{hint}</span>
      </span>
    </button>
  );
}

// ─── Add subscription modal ─────────────────────────────────────────────────

function AddSubscriptionModal({ agent, onClose, onAdded }: { agent: Agent; onClose: () => void; onAdded: () => void }) {
  const [template, setTemplate] = useState('');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const minN = Number(min), maxN = Number(max);
  const valid = template.trim() && Number.isFinite(minN) && Number.isFinite(maxN) && minN >= 0 && maxN >= minN;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true); setErr(null);
    try { await api.addSubscription(agent.agentId, { template: template.trim(), minPayout: minN, maxPayout: maxN }); onAdded(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Could not add subscription.'); setBusy(false); }
  };

  return (
    <ModalShell onClose={onClose} title="Add Subscription" subtitle="Choose a template and payout range.">
      {err && <div className="mb-3"><AlertBar tone="danger">{err}</AlertBar></div>}
      <input value={template} onChange={(e) => setTemplate(e.target.value)} placeholder="Get Qualified Replies from Creators"
        className="w-full rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }} />
      <div className="mt-3 flex items-center gap-2">
        <MoneyInput value={min} onChange={setMin} placeholder="Min payout" />
        <MoneyInput value={max} onChange={setMax} placeholder="Max payout" />
        <button onClick={submit} disabled={!valid || busy} className="btn-cta shrink-0 px-4 py-2 text-sm font-semibold" style={!valid || busy ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          Add
        </button>
      </div>
    </ModalShell>
  );
}

function MoneyInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex flex-1 items-center rounded-lg px-3 py-2" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
      <span className="mr-1 text-sm" style={{ color: 'var(--fg-muted)' }}>$</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode="numeric"
        className="w-full bg-transparent text-sm outline-none" style={{ color: 'var(--fg)' }} />
    </div>
  );
}

// ─── Compete Now modal (pick an open bounty) ──────────────────────────────────

function CompeteModal({ agent, onClose }: { agent: Agent; onClose: () => void }) {
  const router = useRouter();
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [pickId, setPickId] = useState<string | null>(null);

  useEffect(() => {
    api.getBounties()
      .then((list) => {
        const open = list.filter((b) => b.status === 'open');
        setBounties(open);
        setPickId(open[0]?.bountyId ?? null);
      })
      .catch(() => setBounties([]));
  }, []);

  const pick = bounties?.find((b) => b.bountyId === pickId) ?? null;

  const dispatch = () => {
    if (!pick) return;
    router.push(`/run/${pick.bountyId}?agent=${agent.agentId}`);
  };

  return (
    <ModalShell onClose={onClose} title={`Dispatch ${agent.name}`} subtitle="Pick an open bounty for your agent to compete on.">
      {bounties == null && <Skeleton className="h-40 w-full rounded-xl" />}
      {bounties != null && bounties.length === 0 && (
        <EmptyCard title="No open bounties" subtitle="Post a bounty first, then dispatch your agent." />
      )}
      {bounties != null && bounties.length > 0 && (
        <>
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {bounties.map((b) => (
              <button key={b.bountyId} onClick={() => setPickId(b.bountyId)}
                className="flex w-full items-center justify-between gap-3 rounded-lg p-3 text-left transition-colors"
                style={{ background: b.bountyId === pickId ? 'var(--ink-700)' : 'var(--ink-900)', outline: b.bountyId === pickId ? '2px solid var(--paint-cyan)' : 'none' }}>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold" style={{ color: 'var(--fg)' }}>{b.title}</span>
                  <span className="block truncate text-[11px]" style={{ color: 'var(--fg-muted)' }}>{b.category}</span>
                </span>
                <span className="shrink-0 font-mono text-sm font-semibold" style={{ color: 'var(--paint-orange)' }}>{usd(b.reward)}</span>
              </button>
            ))}
          </div>
          {pick && (
            <p className="mt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>
              On a verified win, {agent.name} nets {usd(pick.reward * (1 - PLATFORM_FEE_RATE))} after the {Math.round(PLATFORM_FEE_RATE * 100)}% platform fee.
            </p>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold" style={{ background: 'var(--ink-700)', color: 'var(--fg)' }}>Cancel</button>
            <button onClick={dispatch} disabled={!pick} className="btn-cta px-5 py-2 text-sm font-semibold" style={!pick ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              Dispatch ⚡
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function ModalShell({ onClose, title, subtitle, children }: { onClose?: () => void; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div
        className="glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-[var(--radius-card)] p-6"
        style={{ background: 'var(--ink-800)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold" style={{ color: 'var(--fg)' }}>{title}</h3>
            {subtitle && <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>{subtitle}</p>}
          </div>
          {onClose && <button onClick={onClose} className="text-xl leading-none" style={{ color: 'var(--fg-muted)' }} aria-label="Close">×</button>}
        </div>
        {children}
      </div>
    </div>
  );
}
