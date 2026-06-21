/**
 * SSE event emitter helpers for the run stream.
 * Manages monotonic sequence numbers per run.
 */

import type { RunEvent, RunStage, RunStatus } from '../types';
import store from '../store';

// ─── Sequence counter per run ─────────────────────────────────────────────────

const seqCounters = new Map<string, number>();

function nextSeq(runId: string): number {
  const cur = seqCounters.get(runId) ?? 0;
  const next = cur + 1;
  seqCounters.set(runId, next);
  return next;
}

// ─── Emit event to run store + SSE subscribers ────────────────────────────────

export function emitEvent(
  runId: string,
  partial: { stage: RunStage; status: RunStatus; ts: string; payload?: Record<string, unknown> }
): RunEvent {
  const event: RunEvent = {
    seq: nextSeq(runId),
    runId,
    ...partial,
  };
  store.appendEvent(runId, event);
  return event;
}

// ─── Format RunEvent as SSE wire format ───────────────────────────────────────

export function formatSSE(event: RunEvent): string {
  return `id: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ─── Create an emitter bound to a runId ──────────────────────────────────────

export function createEmitter(runId: string) {
  return (partial: Omit<RunEvent, 'seq' | 'runId'>) =>
    emitEvent(runId, partial as { stage: RunStage; status: RunStatus; ts: string; payload?: Record<string, unknown> });
}
