'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Bounty } from '@/lib/types';
import { api } from '@/lib/client/api';
import { NavBar } from '@/components/NavBar';
import { Footer } from '@/components/Footer';
import { BountyCard } from '@/components/BountyCard';
import { Card, Skeleton, AlertBar, EmptyCard } from '@/components/ui';

const CATEGORIES = ['All', 'Sales & Lead Generation', 'Research & Competitive Intelligence', 'AI Automation & Product Building', 'Hiring & Recruiting', 'Content & Media'];
type Sort = 'recent' | 'reward' | 'category';

export default function BrowsePage() {
  const [bounties, setBounties] = useState<Bounty[] | null>(null);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState<Sort>('recent');

  useEffect(() => {
    api.getBounties().then(setBounties).catch(() => setError(true));
  }, []);

  const filtered = useMemo(() => {
    if (!bounties) return [];
    let list = category === 'All' ? bounties : bounties.filter((b) => b.category === category);
    list = [...list].sort((a, b) => {
      if (sort === 'reward') return b.reward - a.reward;
      if (sort === 'category') return a.category.localeCompare(b.category);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [bounties, category, sort]);

  const categoryCount = bounties ? new Set(bounties.map((b) => b.category)).size : 0;

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-7xl flex-1 px-6 py-10">
        <header className="mb-6">
          <h1 className="font-display text-4xl font-bold" style={{ color: 'var(--fg)' }}>Browse Bounties</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--fg-muted)' }}>
            {bounties ? `${bounties.length} open bounties across ${categoryCount} categories` : 'Loading the marketplace…'}
          </p>
        </header>

        {/* Filter rail */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" style={{ touchAction: 'pan-x' }}>
            {CATEGORIES.map((c) => {
              const active = c === category;
              return (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className="shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={{
                    background: active ? 'var(--paint-blue)' : 'var(--ink-700)',
                    color: active ? '#fff' : 'var(--fg-muted)',
                  }}
                >
                  {c}
                </button>
              );
            })}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="rounded-full px-4 py-2 text-sm font-medium"
            style={{ background: 'var(--ink-700)', color: 'var(--fg)', border: '1px solid var(--border)' }}
            aria-label="Sort bounties"
          >
            <option value="recent">Most Recent</option>
            <option value="reward">Highest Reward</option>
            <option value="category">Category</option>
          </select>
        </div>

        {error && bounties === null && (
          <div className="mb-6"><AlertBar tone="warn">Couldn&apos;t load bounties — try refreshing.</AlertBar></div>
        )}

        {/* Loading */}
        {!bounties && !error && (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <Card key={i} className="min-h-[200px] p-5" style={{ background: 'var(--ink-800)' }}>
                <Skeleton className="h-5 w-24" /><Skeleton className="mt-3 h-6 w-40" /><Skeleton className="mt-3 h-12 w-full" />
              </Card>
            ))}
          </div>
        )}

        {/* Populated / empty */}
        {bounties && (
          filtered.length === 0 ? (
            <EmptyCard title="No bounties in this category yet" subtitle="Try another category or check back soon." />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((b, i) => <BountyCard key={b.bountyId} bounty={b} index={i} />)}
            </div>
          )
        )}
      </main>
      <Footer />
    </>
  );
}
