'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HERO_BOUNTY_ID } from '@/lib/client/constants';

/** Demo-mode auth stub. Focus-trapped, Escape closes. */
export function AuthStubModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in"
      style={{ background: 'rgba(7,6,13,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to post a bounty"
    >
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass anim-slide-up w-full max-w-sm rounded-[var(--radius-card)] p-7 outline-none"
        style={{ background: 'rgba(13,11,26,0.92)' }}
      >
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--fg)' }}>
          Sign in to post a bounty
        </h2>
        <p className="mt-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
          Demo mode — authentication is not required for the live demo run.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button
            className="btn-cta px-5 py-3 text-sm font-semibold"
            onClick={() => { onClose(); router.push(`/run/${HERO_BOUNTY_ID}`); }}
          >
            Watch the Demo →
          </button>
          <button
            className="rounded-full px-5 py-3 text-sm font-semibold"
            style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
