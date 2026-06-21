'use client';

import Link from 'next/link';
import type { Bounty } from '@/lib/types';
import { Card, CategoryBadge, StatusBadge } from './ui';
import { categoryColor, HERO_BOUNTY_ID } from '@/lib/client/constants';
import { usd, relativeTime } from '@/lib/client/format';

export function BountyCard({ bounty, index = 0 }: { bounty: Bounty; index?: number }) {
  const color = categoryColor(bounty.category);
  // The hero bounty links to the live run; others to static detail.
  const href = bounty.bountyId === HERO_BOUNTY_ID
    ? `/run/${bounty.bountyId}`
    : `/bounty/${bounty.bountyId}`;
  const isHero = bounty.bountyId === HERO_BOUNTY_ID;

  return (
    <Link href={href} className="group block anim-slide-up" style={{ animationDelay: `${Math.min(index, 5) * 40}ms` }}>
      <Card
        hover
        className="flex h-full min-h-[200px] flex-col gap-3 p-5"
        style={{ background: 'var(--ink-800)' }}
      >
        <div className="flex items-start justify-between gap-2">
          <CategoryBadge category={bounty.category} color={color} />
          <StatusBadge status={bounty.status} />
        </div>

        <h3 className="font-display text-xl font-semibold leading-snug" style={{ color: 'var(--fg)' }}>
          {bounty.title}
        </h3>
        <p className="clamp-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
          {bounty.description}
        </p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-mono text-base font-medium" style={{ color: 'var(--paint-cyan)' }}>
            {usd(bounty.reward)}
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--fg-muted)' }}>
            {relativeTime(bounty.createdAt)}
          </span>
        </div>

        <span
          className="text-sm font-semibold opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: isHero ? 'var(--paint-magenta)' : 'var(--paint-blue)' }}
        >
          {isHero ? 'Watch It Run →' : 'View Details →'}
        </span>
      </Card>
    </Link>
  );
}
