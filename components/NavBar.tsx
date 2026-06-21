'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { HERO_BOUNTY_ID } from '@/lib/client/constants';
import { AuthStubModal } from './AuthStubModal';

const LINKS = [
  { href: '/browse', label: 'Browse' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/listings', label: 'Listings' },
];

export function NavBar() {
  const pathname = usePathname();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <>
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
              const active = pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-full px-3 py-2 text-sm font-medium transition-colors sm:px-4"
                  style={{ color: active ? 'var(--fg)' : 'var(--fg-muted)' }}
                >
                  {l.label}
                </Link>
              );
            })}
            <button
              onClick={() => setAuthOpen(true)}
              className="hidden rounded-full px-3 py-2 text-sm font-medium transition-colors sm:block"
              style={{ color: 'var(--fg-muted)' }}
            >
              Sign in
            </button>
            <Link
              href={`/run/${HERO_BOUNTY_ID}`}
              className="btn-cta ml-1 px-4 py-2 text-sm font-semibold sm:px-5"
            >
              Run Demo
            </Link>
          </div>
        </nav>
      </header>
      <AuthStubModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
