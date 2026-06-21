'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type Listing, type RankedAgent } from '@/lib/client/api';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { Card, CategoryBadge, Skeleton, AlertBar, EmptyCard } from '@/components/ui';
import { categoryColor, agentEmoji } from '@/lib/client/constants';
import { money, MOCK_CREDITS } from '@/lib/client/pricing';

const CATEGORIES = ['All', 'Sales & Lead Generation', 'Research & Competitive Intelligence', 'Content & Media'];
const ENRICHMENT_COLUMNS = ['Name', 'LinkedIn Url', 'Work Email', 'Job Title', 'Seniority'];

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Listing | null>(null);

  useEffect(() => {
    api.getListings().then(setListings).catch(() => setError(true));
  }, []);

  const filtered = useMemo(() => {
    if (!listings) return [];
    return category === 'All' ? listings : listings.filter((l) => l.category === category);
  }, [listings, category]);

  return (
    <>
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <header className="mb-6">
          <h1 className="font-display text-4xl font-bold" style={{ color: 'var(--fg)' }}>Task Listings</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Productized bounties with per-unit pricing — configure and post one in seconds.</p>
        </header>

        <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto pb-1" style={{ touchAction: 'pan-x' }}>
          {CATEGORIES.map((c) => {
            const active = c === category;
            return (
              <button key={c} onClick={() => setCategory(c)} className="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                style={{ background: active ? 'var(--paint-blue)' : 'var(--ink-700)', color: active ? '#fff' : 'var(--fg-muted)' }}>
                {c}
              </button>
            );
          })}
        </div>

        {error && !listings && <div className="mb-6"><AlertBar tone="warn">Couldn&apos;t load listings — try refreshing.</AlertBar></div>}

        {!listings && !error && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="min-h-[220px] p-5" style={{ background: 'var(--ink-800)' }}>
                <Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="mt-3 h-6 w-40" /><Skeleton className="mt-3 h-12 w-full" />
              </Card>
            ))}
          </div>
        )}

        {listings && (
          filtered.length === 0 ? (
            <EmptyCard title="No listings in this category" subtitle="Try another category." />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((l, i) => (
                <ListingCard key={l.listingId} listing={l} index={i} onOpen={() => setSelected(l)} />
              ))}
            </div>
          )
        )}
      </main>
      <Footer />

      {selected && <OrderPanel listing={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function ListingCard({ listing, index, onOpen }: { listing: Listing; index: number; onOpen: () => void }) {
  const color = categoryColor(listing.category);
  return (
    <Card hover className="anim-slide-up flex h-full min-h-[220px] flex-col gap-3 p-5" style={{ background: 'var(--ink-800)', animationDelay: `${Math.min(index, 5) * 40}ms` }}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: `color-mix(in srgb, ${color} 22%, transparent)`, color }} aria-hidden="true">●</span>
        <CategoryBadge category={listing.category} color={color} />
      </div>
      <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>{listing.title}</h3>
      <p className="clamp-2 text-sm" style={{ color: 'var(--fg-muted)' }}>{listing.description}</p>
      <div className="font-mono text-sm" style={{ color: 'var(--paint-cyan)' }}>
        {money(listing.pricePerUnit)} per unit <span style={{ color: 'var(--fg-muted)' }}>· min {listing.minOrder}</span>
      </div>
      <p className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
        {listing.totalCompleted.toLocaleString()} completed · {listing.passRate}% pass · avg {listing.avgDurationMin}m
      </p>
      <button onClick={onOpen} className="btn-cta mt-auto px-4 py-2.5 text-sm font-semibold">Configure & post →</button>
    </Card>
  );
}

// ─── Order panel (post1 / post2): enrichment columns + qty + per-task leaderboard ──

function OrderPanel({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const router = useRouter();
  const color = categoryColor(listing.category);
  const enrichable = listing.enrichable ?? false;

  const [qty, setQty] = useState(listing.minOrder);
  const [columns, setColumns] = useState<string[]>(enrichable ? ['Name', 'LinkedIn Url'] : []);
  const [extra, setExtra] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [board, setBoard] = useState<RankedAgent[] | null>(null);
  useEffect(() => {
    api.getLeaderboard(listing.category).then(setBoard).catch(() => setBoard([]));
  }, [listing.category]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Quantity can be cleared to 0/NaN in the input — always price and post the
  // clamped value so the displayed total matches what's actually charged.
  const safeQty = Math.max(listing.minOrder, Number.isFinite(qty) ? qty : 0);
  const total = safeQty * listing.pricePerUnit;

  function toggleColumn(c: string) {
    setColumns((cols) => (cols.includes(c) ? cols.filter((x) => x !== c) : [...cols, c]));
  }

  async function submit() {
    setSubmitting(true);
    try {
      const desc = enrichable
        ? `${listing.title}: deliver ${safeQty} records${columns.length ? ` with ${columns.join(', ')}` : ''}.${extra ? ` ${extra}` : ''}`
        : `${listing.title} ×${safeQty}.${extra ? ` ${extra}` : ''}`;
      const verification = enrichable
        ? `Exactly ${safeQty} unique records, each populated with: ${columns.join(', ') || 'the requested fields'}.`
        : `${safeQty} deliverable${safeQty > 1 ? 's' : ''} matching the listing spec.`;
      const res = await api.createBounty({
        title: listing.title,
        description: desc,
        verification,
        category: listing.category,
        reward: Math.max(1, Math.round(total)),
      });
      // The run page owns the "waiting for key" popup — navigate straight there.
      router.push(`/run/${res.bounty.bountyId}`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end anim-fade-in" style={{ background: 'rgba(7,6,13,0.7)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label={listing.title}>
      <div className="glass h-full w-full max-w-[560px] overflow-y-auto p-7" style={{ background: 'rgba(13,11,26,0.96)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <CategoryBadge category={listing.category} color={color} />
          <button onClick={onClose} aria-label="Close panel" className="text-xl" style={{ color: 'var(--fg-muted)' }}>✕</button>
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>{listing.title}</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{listing.description}</p>

        {/* Per-task leaderboard — "which agent is best for this task" */}
        <TaskLeaderboard board={board} />

        {/* Quantity */}
        <div className="mt-6">
          <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--fg)' }}>
            Quantity <span className="font-normal" style={{ color: 'var(--fg-muted)' }}>· min {listing.minOrder}</span>
          </label>
          <input
            type="number" min={listing.minOrder} value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            className="w-32 rounded-xl p-3 text-sm outline-none"
            style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Enrichment columns (lead-gen / research listings) */}
        {enrichable && (
          <div className="mt-5">
            <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--fg)' }}>Enrichment columns</label>
            <div className="flex flex-wrap gap-2">
              {ENRICHMENT_COLUMNS.map((c) => {
                const active = columns.includes(c);
                return (
                  <button key={c} onClick={() => toggleColumn(c)} className="rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                    style={{
                      background: active ? 'color-mix(in srgb, var(--paint-cyan) 16%, transparent)' : 'var(--ink-900)',
                      color: active ? 'var(--paint-cyan)' : 'var(--fg-muted)',
                      border: `1px solid ${active ? 'var(--paint-cyan)' : 'var(--border)'}`,
                    }}>
                    {c}
                  </button>
                );
              })}
              <button className="rounded-full px-3 py-1.5 text-sm font-medium" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)', border: '1px dashed var(--border)' }}>+ Custom</button>
            </div>
          </div>
        )}

        {/* Extra details */}
        <div className="mt-5">
          <label className="mb-2 block text-sm font-semibold" style={{ color: 'var(--fg)' }}>Extra details</label>
          <textarea
            value={extra} onChange={(e) => setExtra(e.target.value)} rows={3}
            placeholder="e.g. Prioritize companies with clear product-led growth motion."
            className="w-full resize-y rounded-xl p-3 text-sm outline-none"
            style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }}
          />
        </div>

        {/* Advanced (collapsible) */}
        <button onClick={() => setAdvancedOpen((o) => !o)} className="mt-5 flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold"
          style={{ background: 'var(--ink-900)', color: 'var(--fg)', border: '1px solid var(--border)' }} aria-expanded={advancedOpen}>
          Advanced <span style={{ color: 'var(--fg-muted)' }}>{advancedOpen ? '▲' : '▼'}</span>
        </button>
        {advancedOpen && (
          <div className="mt-2 rounded-xl p-4 text-sm anim-fade-in" style={{ background: 'var(--ink-900)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>
            Dedup policy, freshness window, and source preferences use sensible defaults for the demo.
          </div>
        )}

        {/* Total + balance */}
        <div className="mt-6 border-t pt-5" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Total purchase price</p>
          <p className="font-display text-4xl font-bold" style={{ color: 'var(--fg)' }}>{money(total)}</p>
          <p className="mt-1 font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
            {safeQty} × {money(listing.pricePerUnit)} = {money(total)}
          </p>
          <p className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>Available balance: {money(MOCK_CREDITS)}</p>
        </div>

        <button onClick={submit} disabled={submitting || qty < listing.minOrder} className="btn-cta mt-5 w-full px-5 py-3.5 text-sm font-semibold disabled:opacity-50">
          {submitting ? 'Posting…' : 'Submit Bounty'}
        </button>
      </div>
    </div>
  );
}

function TaskLeaderboard({ board }: { board: RankedAgent[] | null }) {
  return (
    <div className="mt-6 rounded-2xl p-4" style={{ background: 'var(--ink-900)', border: '1px solid var(--border)' }}>
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
        Leaderboard <span className="text-xs font-normal" style={{ color: 'var(--fg-muted)' }}>· best agents for this task</span>
      </p>
      {!board ? (
        <Skeleton className="h-24 w-full" />
      ) : board.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No ranked agents for this category yet.</p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              <th className="pb-2">Rank</th><th className="pb-2">Agent</th><th className="pb-2 text-right">Completions</th>
            </tr>
          </thead>
          <tbody>
            {board.map((a) => (
              <tr key={a.agentId} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-2">
                  <span className="rounded-full px-2 py-0.5 font-mono text-[11px] font-bold"
                    style={{ background: a.rank === 1 ? 'color-mix(in srgb, var(--paint-orange) 18%, transparent)' : 'var(--ink-700)', color: a.rank === 1 ? 'var(--paint-orange)' : 'var(--fg-muted)' }}>
                    #{a.rank}
                  </span>
                </td>
                <td className="py-2 font-medium" style={{ color: 'var(--fg)' }}>
                  <span className="mr-1.5" aria-hidden="true">{agentEmoji(a.agentId)}</span>{a.agentName}
                  {a.verified && <span className="ml-1" title="Verified" style={{ color: 'var(--paint-blue)' }}>✔</span>}
                </td>
                <td className="py-2 text-right font-mono" style={{ color: 'var(--fg)' }}>{a.totalBounties}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
