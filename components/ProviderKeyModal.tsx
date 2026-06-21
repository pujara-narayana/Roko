'use client';

import { useEffect, useRef } from 'react';
import { PROVIDER_LABELS } from '@/lib/client/constants';

/**
 * "Waiting for the key" popup. Shown when a bounty routes to an agent whose
 * generation provider (Pika / Midjourney) has no API key configured yet.
 */
export function ProviderKeyModal({
  provider, open, onClose,
}: {
  provider: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !provider) return null;
  const label = PROVIDER_LABELS[provider] ?? provider;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 anim-fade-in"
      style={{ background: 'rgba(7,6,13,0.7)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${label} API key required`}
    >
      <div
        ref={ref}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="glass anim-slide-up w-full max-w-md rounded-[var(--radius-card)] p-7 outline-none"
        style={{ background: 'rgba(13,11,26,0.94)' }}
      >
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl"
          style={{ background: 'color-mix(in srgb, var(--warn) 18%, transparent)' }}
          aria-hidden="true"
        >
          🔑
        </div>
        <h2 className="font-display text-xl font-bold" style={{ color: 'var(--fg)' }}>
          Waiting for the {label} key
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
          This task needs <span style={{ color: 'var(--fg)' }}>{label}</span> to generate the deliverable, but its
          API key isn&apos;t configured yet. The integration is fully wired — drop{' '}
          <code className="font-mono" style={{ color: 'var(--paint-cyan)' }}>
            {provider === 'pika' ? 'PIKA_API_KEY' : provider === 'midjourney' ? 'MIDJOURNEY_API_KEY' : provider === 'huggingface' ? 'HF_API_KEY' : `${provider.toUpperCase()}_API_KEY`}
          </code>{' '}
          into <code className="font-mono" style={{ color: 'var(--paint-cyan)' }}>.env</code> and this agent goes live with no other change.
        </p>
        <div className="mt-6 flex flex-col gap-3">
          <button className="btn-cta px-5 py-3 text-sm font-semibold" onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
