'use client';

import type { StageKey, StageState } from '@/lib/client/useRunStream';

const STAGES: { key: StageKey; label: string }[] = [
  { key: 'intake', label: 'POST' },
  { key: 'compete', label: 'COMPETE' },
  { key: 'verify', label: 'VERIFY' },
  { key: 'settle', label: 'SETTLE' },
];

function pipColor(s: StageState): string {
  if (s === 'complete') return 'var(--paint-cyan)';
  if (s === 'active') return 'var(--paint-blue)';
  return 'var(--ink-700)';
}

export function StageIndicator({ stages }: { stages: Record<StageKey, StageState> }) {
  return (
    <ol role="list" className="flex items-center gap-2" aria-label="Pipeline stages">
      {STAGES.map((stage, i) => {
        const state = stages[stage.key];
        const color = pipColor(state);
        return (
          <li
            key={stage.key}
            role="listitem"
            className="flex flex-1 flex-col items-center gap-1.5"
            aria-label={`Stage ${i + 1} of 4: ${stage.label} — ${state}`}
          >
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${state === 'active' ? 'pulse-blue' : ''}`}
              style={{
                background: state === 'pending' ? 'transparent' : color,
                border: `2px solid ${color}`,
                color: state === 'pending' ? 'var(--fg-muted)' : '#07060D',
              }}
            >
              {state === 'complete' ? '✓' : i + 1}
            </span>
            <span
              className="font-mono text-[9px] font-semibold tracking-wider"
              style={{ color: state === 'pending' ? 'var(--fg-muted)' : color }}
            >
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
