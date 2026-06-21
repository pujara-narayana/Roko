'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { Card, AlertBar } from '@/components/ui';
import { ProviderKeyModal } from '@/components/ProviderKeyModal';
import { api, type RankedAgent } from '@/lib/client/api';
import { CATEGORIES, resolveTaskType, specialtyForTaskType } from '@/lib/categories';
import { computePricing, money, MIN_DEPOSIT } from '@/lib/client/pricing';
import type { ProviderStatus } from '@/lib/types';
import { agentEmoji, agentName, PROVIDER_LABELS } from '@/lib/client/constants';

const STEPS = ['Details', 'Review', 'Fund'] as const;
const TIME_UNITS = ['Minutes', 'Hours', 'Days'] as const;
const SPECIALTY_PROVIDER: Record<string, string | null> = {
  image: 'midjourney', video: 'pika', research: null, code: null, presentation: null,
};

export default function PostBountyPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // form state
  const [description, setDescription] = useState('');
  const [verification, setVerification] = useState('');
  const [timeValue, setTimeValue] = useState('5');
  const [timeUnit, setTimeUnit] = useState<(typeof TIME_UNITS)[number]>('Minutes');
  const [category, setCategory] = useState('');
  const [catSearch, setCatSearch] = useState('');
  const [price, setPrice] = useState('1');
  const [attachments, setAttachments] = useState<string[]>([]);

  // submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyModal, setKeyModal] = useState<string | null>(null);

  // best-agent + provider lookups
  const [agents, setAgents] = useState<RankedAgent[]>([]);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  useEffect(() => {
    api.getLeaderboard().then(setAgents).catch(() => {});
    api.getProviders().then(setProviders).catch(() => {});
  }, []);

  const reward = Math.max(0, Number(price) || 0);
  const pricing = useMemo(() => computePricing(reward), [reward]);

  const taskType = useMemo(
    () => (category ? resolveTaskType(category, `${description} ${verification}`) : 'data-research'),
    [category, description, verification],
  );
  const bestAgent = useMemo(() => {
    const specialty = specialtyForTaskType(taskType);
    return agents.find((a) => a.specialty === specialty) ?? null;
  }, [agents, taskType]);
  const missingProvider = useMemo(() => {
    const prov = SPECIALTY_PROVIDER[specialtyForTaskType(taskType)];
    if (!prov) return null;
    const status = providers.find((p) => p.id === prov);
    return status && !status.configured ? prov : null;
  }, [providers, taskType]);

  const filteredCats = CATEGORIES.filter(
    (c) => c.label.toLowerCase().includes(catSearch.toLowerCase()) || c.description.toLowerCase().includes(catSearch.toLowerCase()),
  );

  const detailsValid = description.trim().length > 5 && verification.trim().length > 3 && !!category && reward >= MIN_DEPOSIT;

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.createBounty({
        description: description.trim(),
        verification: verification.trim(),
        category,
        reward,
        taskType, // send our resolved type so the run matches the pre-warning
        timeToCompleteMin: toMinutes(Number(timeValue) || 0, timeUnit),
        attachments,
      });
      // The run page owns the "waiting for key" popup — navigate straight there.
      router.push(`/run/${res.bounty.bountyId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to post bounty');
      setSubmitting(false);
    }
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <Link href="/browse" className="mb-5 inline-flex items-center gap-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
          ← Bounties
        </Link>

        <Stepper step={step} />

        {step === 0 && (
          <Card className="mt-6 p-6 sm:p-8" style={{ background: 'var(--ink-800)' }}>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>Post a bounty</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
                  Tell agents what you need done, when it should be delivered, and what you will pay.
                </p>
              </div>
              <button onClick={clearAll} className="text-sm font-medium" style={{ color: 'var(--paint-blue)' }}>Clear</button>
            </div>

            {/* Task details */}
            <Field label="Task details" required>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Generate a video of a sprinter winning the championship final…"
                className="w-full resize-y rounded-xl p-3 text-sm outline-none"
                style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
              />
              <button
                type="button"
                onClick={() => setAttachments((a) => [...a, `attachment-${a.length + 1}.png`])}
                className="mt-1 text-xs"
                style={{ color: 'var(--fg-muted)' }}
              >
                📎 Add attachment (stub)
              </button>
              {attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {attachments.map((a, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-[11px]" style={{ background: 'var(--ink-700)', color: 'var(--fg-muted)' }}>
                      {a}
                      <button onClick={() => setAttachments((arr) => arr.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </Field>

            {/* Verification */}
            <Field label="How will you verify it?" required>
              <textarea
                value={verification}
                onChange={(e) => setVerification(e.target.value)}
                rows={3}
                placeholder="Payment is released when the video is 15–20 seconds long and shows the sprinter crossing the line first."
                className="w-full resize-y rounded-xl p-3 text-sm outline-none"
                style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
              />
            </Field>

            {/* Time to complete */}
            <Field label="Time to complete" required>
              <div className="flex gap-3">
                <input
                  type="number" min={1} value={timeValue}
                  onChange={(e) => setTimeValue(e.target.value)}
                  className="w-24 rounded-xl p-3 text-sm outline-none"
                  style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                />
                <select
                  value={timeUnit}
                  onChange={(e) => setTimeUnit(e.target.value as (typeof TIME_UNITS)[number])}
                  className="rounded-xl p-3 text-sm outline-none"
                  style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
                >
                  {TIME_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </Field>

            {/* Category */}
            <Field label="Category">
              <p className="-mt-1 mb-2 text-xs" style={{ color: 'var(--fg-muted)' }}>Choose where agents are most likely to look for this bounty.</p>
              <input
                value={catSearch}
                onChange={(e) => setCatSearch(e.target.value)}
                placeholder="🔍  Search categories"
                className="mb-3 w-full rounded-xl p-2.5 text-sm outline-none"
                style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {filteredCats.map((c) => {
                  const active = category === c.label;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.label)}
                      className="flex flex-col gap-1 rounded-xl p-3 text-left transition-colors"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--paint-cyan) 12%, var(--ink-900))' : 'var(--ink-900)',
                        border: `1px solid ${active ? 'var(--paint-cyan)' : 'var(--border)'}`,
                      }}
                    >
                      <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                        <span aria-hidden="true">{c.icon}</span>{c.label}
                        {active && <span className="ml-auto" style={{ color: 'var(--paint-cyan)' }}>✓</span>}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{c.description}</span>
                    </button>
                  );
                })}
              </div>
            </Field>

            {/* Price */}
            <Field label="Price">
              <p className="-mt-1 mb-2 text-xs" style={{ color: 'var(--fg-muted)' }}>Choose the payout agents will see before claiming the bounty.</p>
              <div className="flex items-center gap-1 rounded-xl px-3" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
                <span className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>$</span>
                <input
                  type="number" min={MIN_DEPOSIT} step="1" value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-transparent py-3 font-display text-2xl font-bold outline-none"
                  style={{ color: 'var(--fg)' }}
                />
              </div>
            </Field>

            {bestAgent && (
              <div className="mt-5">
                <BestAgentHint agent={bestAgent} missingProvider={missingProvider} onShowKey={() => setKeyModal(missingProvider)} />
              </div>
            )}

            <div className="mt-7 flex justify-end">
              <button
                disabled={!detailsValid}
                onClick={() => setStep(1)}
                className="btn-cta px-6 py-3 text-sm font-semibold disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </Card>
        )}

        {step === 1 && (
          <Card className="mt-6 p-6 sm:p-8" style={{ background: 'var(--ink-800)' }}>
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>Review</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Confirm the bounty details before payment and posting.</p>

            <ol className="mt-6 space-y-5">
              <ReviewRow n={1} label="Description" value={description} />
              <ReviewRow n={2} label="Verification" value={verification} />
              <ReviewRow n={3} label="Category" value={category} />
              <ReviewRow n={4} label="Time to complete" value={`${timeValue} ${timeUnit.toLowerCase()}`} />
              <ReviewRow n={5} label="Attachments" value={attachments.length ? attachments.join(', ') : 'None'} />
              <ReviewRow n={6} label="Bounty payout" value={money(reward)} mono />
              {bestAgent && (
                <ReviewRow n={7} label="Best-fit agent" value={`${agentEmoji(bestAgent.agentId)} ${bestAgent.agentName} · ${bestAgent.specialty}`} />
              )}
            </ol>

            {missingProvider && (
              <div className="mt-5">
                <AlertBar tone="warn">
                  🔑 {agentName(bestAgent?.agentId ?? '')} needs the {PROVIDER_LABELS[missingProvider] ?? missingProvider} key — you can still post; the run will show the waiting-for-key state.
                </AlertBar>
              </div>
            )}

            <div className="mt-7 flex justify-between">
              <button onClick={() => setStep(0)} className="rounded-full px-5 py-3 text-sm font-semibold" style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}>Back</button>
              <button onClick={() => setStep(2)} className="btn-cta px-6 py-3 text-sm font-semibold">Next</button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="mt-6 p-6 sm:p-8" style={{ background: 'var(--ink-800)' }}>
            <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>Fund and post</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Pay any remaining amount, then post the bounty for agents to claim.</p>

            <div className="mt-6 rounded-2xl p-5" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
              <PayRow label="Bounty payout" value={money(pricing.payout)} />
              <PayRow label="Platform fee (10%)" value={money(pricing.platformFee)} />
              <div className="my-3 border-t" style={{ borderColor: 'var(--border)' }} />
              <PayRow label="You pay" value={money(pricing.total)} bold />
            </div>

            <div className="mt-3 flex items-center justify-between rounded-2xl px-5 py-4" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--fg)' }}>Credits applied</span>
              <span className="font-mono text-sm font-semibold" style={{ color: 'var(--paint-cyan)' }}>−{money(pricing.creditsApplied)}</span>
            </div>

            <div className="mt-3 space-y-3">
              <PayMethod icon="💳" label="Card" />
              <PayMethod icon="$" label="Cash App Pay" badge />
            </div>
            <p className="mt-3 text-xs" style={{ color: 'var(--fg-muted)' }}>Minimum deposit is {money(MIN_DEPOSIT)}. Payments are simulated — no real charge.</p>

            {error && <div className="mt-4"><AlertBar tone="danger">{error}</AlertBar></div>}

            <div className="mt-7 flex justify-between">
              <button onClick={() => setStep(1)} disabled={submitting} className="rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-40" style={{ border: '1px solid var(--border)', color: 'var(--fg)' }}>Back</button>
              <button onClick={submit} disabled={submitting} className="btn-cta px-6 py-3 text-sm font-semibold disabled:opacity-60">
                {submitting ? 'Posting…' : 'Pay and post bounty'}
              </button>
            </div>
          </Card>
        )}
      </main>
      <Footer />
      <ProviderKeyModal provider={keyModal} open={!!keyModal} onClose={() => setKeyModal(null)} />
    </>
  );

  function clearAll() {
    setDescription(''); setVerification(''); setTimeValue('5'); setTimeUnit('Minutes');
    setCategory(''); setCatSearch(''); setPrice('1'); setAttachments([]);
  }
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Stepper({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-2 rounded-full p-2" style={{ background: 'var(--ink-800)', border: '1px solid var(--border)' }}>
      {STEPS.map((label, i) => {
        const done = i < step;
        const active = i === step;
        const color = done || active ? 'var(--paint-cyan)' : 'var(--fg-muted)';
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: active || done ? color : 'var(--ink-700)', color: active || done ? '#07060D' : 'var(--fg-muted)' }}>
              {done ? '✓' : i + 1}
            </span>
            <span className="text-sm font-medium" style={{ color: active ? 'var(--fg)' : 'var(--fg-muted)' }}>{label}</span>
            {i < STEPS.length - 1 && <span className="ml-1 hidden h-px flex-1 sm:block" style={{ background: done ? 'var(--paint-cyan)' : 'var(--border)' }} />}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--fg)' }}>
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function ReviewRow({ n, label, value, mono }: { n: number; label: string; value: string; mono?: boolean }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ background: 'var(--ink-700)', color: 'var(--fg-muted)' }}>{n}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>{label}</p>
        <p className={`mt-0.5 text-sm ${mono ? 'font-mono' : ''}`} style={{ color: 'var(--fg-muted)', whiteSpace: 'pre-wrap' }}>{value || '—'}</p>
      </div>
    </li>
  );
}

function PayRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm ${bold ? 'font-bold' : ''}`} style={{ color: 'var(--fg)' }}>{label}</span>
      <span className={`font-mono ${bold ? 'text-lg font-bold' : 'text-sm'}`} style={{ color: 'var(--fg)' }}>{value}</span>
    </div>
  );
}

function PayMethod({ icon, label, badge }: { icon: string; label: string; badge?: boolean }) {
  return (
    <button className="flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left transition-colors" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
      <span className={`flex h-7 w-9 items-center justify-center rounded ${badge ? 'font-bold' : ''}`} style={{ background: badge ? 'var(--success)' : 'var(--ink-700)', color: badge ? '#07060D' : 'var(--fg)' }} aria-hidden="true">{icon}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--fg)' }}>{label}</span>
    </button>
  );
}

function BestAgentHint({ agent, missingProvider, onShowKey }: { agent: RankedAgent; missingProvider: string | null; onShowKey: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
      <span className="text-lg" aria-hidden="true">{agentEmoji(agent.agentId)}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          Best fit: {agent.agentName} <span className="font-normal" style={{ color: 'var(--fg-muted)' }}>· {agent.specialty}</span>
        </p>
        <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>{agent.totalBounties} completions · {Math.round(agent.passRate)}% pass</p>
      </div>
      {missingProvider && (
        <button onClick={onShowKey} className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'color-mix(in srgb, var(--warn) 16%, transparent)', color: 'var(--warn)' }}>
          🔑 Needs key
        </button>
      )}
    </div>
  );
}

function toMinutes(value: number, unit: (typeof TIME_UNITS)[number]): number {
  if (unit === 'Hours') return value * 60;
  if (unit === 'Days') return value * 60 * 24;
  return value;
}
