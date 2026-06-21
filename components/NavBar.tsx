'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HERO_BOUNTY_ID } from '@/lib/client/constants';
import { MOCK_CREDITS, money } from '@/lib/client/pricing';

const LINKS = [
  { href: '/browse', label: 'Browse tasks' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/listings', label: 'Listings' },
  { href: '/browse?mine=1', label: 'My bounties' },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header
      className="sticky top-0 z-40 w-full border-b backdrop-blur"
      style={{ borderColor: 'var(--border)', background: 'rgba(7,6,13,0.72)' }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Bounty home">
          <span
            className="inline-block h-6 w-6 rounded-md"
            style={{ background: 'var(--gradient-cta)' }}
            aria-hidden="true"
          />
          <span className="font-display text-lg font-bold tracking-tight" style={{ color: 'var(--fg)' }}>
            Bounty
          </span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => {
            const active = l.href.startsWith('/browse')
              ? pathname === '/browse' && l.href.includes('mine') === false
              : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className="hidden rounded-full px-3 py-2 text-sm font-medium transition-colors sm:block sm:px-4"
                style={{ color: active ? 'var(--fg)' : 'var(--fg-muted)' }}
              >
                {l.label}
              </Link>
            );
          })}

          {/* Mock wallet balance (hardcoded — no real payments) */}
          <span
            className="ml-1 hidden rounded-full px-3 py-1.5 font-mono text-sm font-semibold sm:inline-block"
            style={{ background: 'var(--ink-700)', color: 'var(--paint-cyan)' }}
            title="Demo credits (no real payments)"
          >
            {money(MOCK_CREDITS)}
          </span>

          <Link href={`/run/${HERO_BOUNTY_ID}`} className="hidden rounded-full px-3 py-2 text-sm font-medium sm:block" style={{ color: 'var(--fg-muted)' }}>
            Run Demo
          </Link>
          <Link
            href="/post"
            className="btn-cta ml-1 px-4 py-2 text-sm font-semibold sm:px-5"
          >
            Post a bounty
          </Link>
        </div>
      </nav>
    </header>
  );
}
