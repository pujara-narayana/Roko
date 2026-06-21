'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type Listing } from '@/lib/client/api';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { Card, CategoryBadge, Skeleton, AlertBar, EmptyCard } from '@/components/ui';
import { AuthStubModal } from '@/components/AuthStubModal';
import { categoryColor } from '@/lib/client/constants';
import { usd } from '@/lib/client/format';

const CATEGORIES = ['All', 'Data & Research', 'Lead Generation', 'AI Media', 'Outreach', 'Content'];

export default function ListingsPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState<Listing | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

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
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>Productized bounties with verified pricing</p>
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

      {/* Slide-over */}
      {selected && (
        <SlideOver listing={selected} onClose={() => setSelected(null)} onPost={() => { setSelected(null); setAuthOpen(true); }} />
      )}
      <AuthStubModal open={authOpen} onClose={() => setAuthOpen(false)} />
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
        {usd(listing.pricePerUnit)} per unit <span style={{ color: 'var(--fg-muted)' }}>· min {listing.minOrder}</span>
      </div>
      <p className="font-mono text-[11px]" style={{ color: 'var(--fg-muted)' }}>
        {listing.totalCompleted.toLocaleString()} completed · {listing.passRate}% pass · avg {listing.avgDurationMin}m
      </p>
      <button onClick={onOpen} className="btn-cta mt-auto px-4 py-2.5 text-sm font-semibold">Post Bounty →</button>
    </Card>
  );
}

function SlideOver({ listing, onClose, onPost }: { listing: Listing; onClose: () => void; onPost: () => void }) {
  const color = categoryColor(listing.category);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end anim-fade-in" style={{ background: 'rgba(7,6,13,0.7)' }} onClick={onClose} role="dialog" aria-modal="true" aria-label={listing.title}>
      <div className="glass h-full w-full max-w-[480px] overflow-y-auto p-7" style={{ background: 'rgba(13,11,26,0.96)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <CategoryBadge category={listing.category} color={color} />
          <button onClick={onClose} aria-label="Close panel" className="text-xl" style={{ color: 'var(--fg-muted)' }}>✕</button>
        </div>
        <h2 className="mt-4 font-display text-2xl font-bold" style={{ color: 'var(--fg)' }}>{listing.title}</h2>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{listing.description}</p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Mini label="Price / unit" value={usd(listing.pricePerUnit)} color="var(--paint-cyan)" />
          <Mini label="Min order" value={String(listing.minOrder)} color="var(--fg)" />
          <Mini label="Completed" value={listing.totalCompleted.toLocaleString()} color="var(--paint-blue)" />
          <Mini label="Pass rate" value={`${listing.passRate}%`} color="var(--paint-cyan)" />
        </div>

        <button onClick={onPost} className="btn-cta mt-7 w-full px-5 py-3.5 text-sm font-semibold">Post Bounty</button>
      </div>
    </div>
  );
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--ink-900)' }}>
      <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{label}</p>
      <p className="mt-1 font-mono text-base font-semibold" style={{ color }}>{value}</p>
    </div>
  );
}
