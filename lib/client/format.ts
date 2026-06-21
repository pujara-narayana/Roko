// ─────────────────────────────────────────────
//  Display formatters — all money/scores/timers
//  render in JetBrains Mono with tabular-nums.
// ─────────────────────────────────────────────

export function usd(amount: number): string {
  return `$${amount.toLocaleString('en-US')}`;
}

export function compactNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** ms → "2m 14s" / "14s" */
export function durationLabel(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** seconds → "2m 14s elapsed"-friendly mono string */
export function elapsedLabel(seconds: number): string {
  return durationLabel(seconds * 1000);
}

/** ISO timestamp → "3m ago" relative label */
export function relativeTime(iso?: string): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function pct(value: number): string {
  return `${Math.round(value)}%`;
}

/** Some seeded log lines arrive mojibake-encoded (UTF-8 ellipsis/≥).
 *  Normalise the common cases so the demo reads clean. */
export function cleanText(s: string): string {
  if (!s) return s;
  return s
    .replace(/â€¦/g, '…')
    .replace(/â‰¥/g, '≥')
    .replace(/â€”/g, '—')
    .replace(/â€"/g, '–');
}
