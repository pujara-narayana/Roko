'use client';

// ─────────────────────────────────────────────
//  useRunStream — drives the Run view centerpiece.
//
//  Lifecycle:
//    1. POST /api/runs {bountyId}  -> { runId, streamUrl }
//    2. Open EventSource(streamUrl). On message, parse RunEvent,
//       dedupe by monotonic seq, fold into PipelineState.
//    3. On EventSource error -> fall back to polling
//       GET /api/runs/:runId/events?after=<lastSeq>.
//    4. On `done/complete` -> stop, mark complete.
//
//  Backend emits real RunEvent {seq,stage,status,ts,payload}.
//  We map (stage,status) pairs to UI state per the SSE→UI table.
// ─────────────────────────────────────────────

import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { RunEvent, OracleReason, GateResult, OracleSubScores, CompanyRecord, GenericDeliverable } from '@/lib/types';

export type StageKey = 'intake' | 'compete' | 'verify' | 'settle';
export type StageState = 'pending' | 'active' | 'complete';
export type AgentStatus = 'queued' | 'working' | 'submitted' | 'failed' | 'awaiting';

export interface AgentCardState {
  agentId: string;
  name?: string;               // display name (user agents aren't in the static roster)
  emoji?: string;              // display emoji
  status: AgentStatus;
  logLines: string[];          // most-recent-last, capped
  progressStep: number;
  totalSteps: number;
  recordCount?: number;
  source?: string;
  deliverableTitle?: string;   // non-data tasks
  awaitingKey?: string;        // provider id when blocked on a missing key
  records?: CompanyRecord[];        // actual submitted data (data tasks)
  deliverable?: GenericDeliverable; // actual submitted artifact (other tasks)
}

export interface VerdictState {
  submissionId: string;
  agentId: string;
  verdict: 'pass' | 'fail';
  subScores: OracleSubScores;
  overallScore: number;
  summary: string;
  reasons: OracleReason[];
  gateResults: GateResult[];
  duplicates: number;
}

export interface SettlementState {
  action: 'release' | 'return';
  winnerAgentId?: string;
  fallbackWinner?: string;
  amountUsd?: number;
  transactionId?: string;
  returnedTo?: string;
}

export type ConnectionState = 'idle' | 'connecting' | 'live' | 'polling' | 'reconnecting' | 'closed' | 'error';

export interface PipelineState {
  runId?: string;
  lastSeq: number;
  stages: Record<StageKey, StageState>;
  activeStage: StageKey | null;
  // intake / escrow
  requirementsId?: string;
  escrowFunded: boolean;
  escrowAmount?: number;
  // compete
  agents: Record<string, AgentCardState>;
  agentOrder: string[];
  // verify
  oracleRunning: boolean;
  oracleChecking?: string;     // agentId currently being checked
  verdicts: Record<string, VerdictState>;
  verdictOrder: string[];
  // settle
  settlement?: SettlementState;
  leaderboard?: Array<{ agentId: string; name: string; reputationScore: number }>;
  // provider gating — set when a media task is blocked on a missing key
  awaitingKey?: string;
  // lifecycle
  connection: ConnectionState;
  complete: boolean;
  failed?: string;
}

const LOG_CAP = 5;

function initialState(): PipelineState {
  return {
    lastSeq: 0,
    stages: { intake: 'pending', compete: 'pending', verify: 'pending', settle: 'pending' },
    activeStage: null,
    escrowFunded: false,
    agents: {},
    agentOrder: [],
    oracleRunning: false,
    verdicts: {},
    verdictOrder: [],
    connection: 'idle',
    complete: false,
  };
}

type Action =
  | { type: 'reset' }
  | { type: 'runStarted'; runId: string }
  | { type: 'connection'; value: ConnectionState }
  | { type: 'event'; event: RunEvent };

function setStage(stages: Record<StageKey, StageState>, key: StageKey, value: StageState) {
  return { ...stages, [key]: value };
}

function ensureAgent(state: PipelineState, agentId: string): PipelineState {
  if (state.agents[agentId]) return state;
  return {
    ...state,
    agents: {
      ...state.agents,
      [agentId]: { agentId, status: 'queued', logLines: [], progressStep: 0, totalSteps: 5 },
    },
    agentOrder: [...state.agentOrder, agentId],
  };
}

function reduceEvent(prev: PipelineState, event: RunEvent): PipelineState {
  // Monotonic dedupe — ignore replays/duplicates.
  if (event.seq <= prev.lastSeq) return prev;
  let state: PipelineState = { ...prev, lastSeq: event.seq };
  const p = (event.payload ?? {}) as Record<string, unknown>;

  // Heartbeats only keep the SSE stream alive — they carry no state transition
  // and must never re-activate an already-completed stage.
  if (p.heartbeat) return state;

  switch (event.stage) {
    case 'intake': {
      if (event.status === 'in_progress') {
        state = { ...state, activeStage: 'intake', stages: setStage(state.stages, 'intake', 'active') };
      } else if (event.status === 'done') {
        state = {
          ...state,
          requirementsId: p.requirementsId as string | undefined,
          stages: setStage(state.stages, 'intake', 'complete'),
        };
      }
      break;
    }
    case 'escrow': {
      if (event.status === 'funded') {
        state = { ...state, escrowFunded: true, escrowAmount: p.amountUsd as number | undefined };
      }
      break;
    }
    case 'compete': {
      state = { ...state, activeStage: 'compete', stages: setStage(state.stages, 'compete', 'active') };
      const agentId = p.agentId as string | undefined;
      // Roll-up "submitted" event (no agentId) carries the run-level awaitingKey.
      if (!agentId && p.awaitingKey) {
        state = { ...state, awaitingKey: p.awaitingKey as string };
      }
      if (event.status === 'in_progress' && agentId) {
        state = ensureAgent(state, agentId);
        const card = state.agents[agentId];
        const logLine = p.logLine as string | undefined;
        const nextLogs = logLine ? [...card.logLines, logLine].slice(-LOG_CAP) : card.logLines;
        const isAwaiting = !!p.awaitingKey;
        state = {
          ...state,
          awaitingKey: isAwaiting ? (p.awaitingKey as string) : state.awaitingKey,
          agents: {
            ...state.agents,
            [agentId]: {
              ...card,
              name: (p.agentName as string) ?? card.name,
              emoji: (p.agentEmoji as string) ?? card.emoji,
              status: isAwaiting ? 'awaiting' : 'working',
              awaitingKey: isAwaiting ? (p.awaitingKey as string) : card.awaitingKey,
              deliverableTitle: (p.deliverableTitle as string) ?? card.deliverableTitle,
              logLines: nextLogs,
              // A blocked (awaiting-key) agent is terminal — fill the bar so it
              // doesn't read as "still working".
              progressStep: isAwaiting ? ((p.totalSteps as number) ?? card.totalSteps) : ((p.progressStep as number) ?? card.progressStep),
              totalSteps: (p.totalSteps as number) ?? card.totalSteps,
            },
          },
        };
      } else if (event.status === 'submitted' && agentId) {
        // per-agent submitted event (roll-up event has no agentId — skip it)
        state = ensureAgent(state, agentId);
        const card = state.agents[agentId];
        state = {
          ...state,
          agents: {
            ...state.agents,
            [agentId]: {
              ...card,
              name: (p.agentName as string) ?? card.name,
              emoji: (p.agentEmoji as string) ?? card.emoji,
              status: 'submitted',
              recordCount: p.recordCount as number | undefined,
              source: p.source as string | undefined,
              deliverableTitle: (p.deliverableTitle as string) ?? card.deliverableTitle,
              records: (p.records as CompanyRecord[] | undefined) ?? card.records,
              deliverable: (p.deliverable as GenericDeliverable | undefined) ?? card.deliverable,
              progressStep: card.totalSteps,
            },
          },
        };
      } else if (event.status === 'failed' && agentId) {
        state = ensureAgent(state, agentId);
        const card = state.agents[agentId];
        state = { ...state, agents: { ...state.agents, [agentId]: { ...card, status: 'failed' } } };
      }
      break;
    }
    case 'verify': {
      state = {
        ...state,
        activeStage: 'verify',
        oracleRunning: true,
        stages: { ...setStage(state.stages, 'compete', 'complete'), verify: 'active' },
      };
      if (event.status === 'in_progress') {
        const agentId = p.agentId as string | undefined;
        if (agentId) state = { ...state, oracleChecking: agentId };
      } else if (event.status === 'done') {
        const verdict: VerdictState = {
          submissionId: p.submissionId as string,
          agentId: p.agentId as string,
          verdict: p.verdict as 'pass' | 'fail',
          subScores: p.subScores as OracleSubScores,
          overallScore: p.overallScore as number,
          summary: p.summary as string,
          reasons: (p.reasons as OracleReason[]) ?? [],
          gateResults: (p.gateResults as GateResult[]) ?? [],
          duplicates: (p.duplicates as number) ?? 0,
        };
        const alreadyHave = !!state.verdicts[verdict.agentId];
        state = {
          ...state,
          oracleChecking: undefined,
          verdicts: { ...state.verdicts, [verdict.agentId]: verdict },
          verdictOrder: alreadyHave ? state.verdictOrder : [...state.verdictOrder, verdict.agentId],
        };
      }
      break;
    }
    case 'settle': {
      state = {
        ...state,
        activeStage: 'settle',
        oracleRunning: false,
        stages: { ...setStage(state.stages, 'verify', 'complete'), settle: 'active' },
      };
      if (event.status === 'in_progress') {
        state = {
          ...state,
          settlement: {
            ...(state.settlement ?? { action: (p.escrowAction as 'release' | 'return') ?? 'release' }),
            action: (p.escrowAction as 'release' | 'return') ?? 'release',
            winnerAgentId: (p.winner as string) ?? state.settlement?.winnerAgentId,
            fallbackWinner: (p.fallbackWinner as string) ?? state.settlement?.fallbackWinner,
          },
        };
      } else if (event.status === 'released') {
        state = {
          ...state,
          settlement: {
            ...(state.settlement ?? { action: 'release' }),
            action: 'release',
            winnerAgentId: p.winnerAgentId as string,
            amountUsd: p.amountUsd as number,
            transactionId: p.transactionId as string,
          },
        };
      } else if (event.status === 'returned') {
        state = {
          ...state,
          settlement: {
            ...(state.settlement ?? { action: 'return' }),
            action: 'return',
            fallbackWinner: p.fallbackWinner as string,
            returnedTo: p.returnedTo as string,
            transactionId: p.transactionId as string,
          },
        };
      }
      break;
    }
    case 'done': {
      if (event.status === 'complete') {
        state = {
          ...state,
          stages: setStage(state.stages, 'settle', 'complete'),
          activeStage: null,
          complete: true,
          awaitingKey: (p.awaitingKey as string) ?? state.awaitingKey,
          leaderboard: p.leaderboard as PipelineState['leaderboard'],
        };
      } else if (event.status === 'failed') {
        state = { ...state, failed: (p.error as string) ?? 'Pipeline error', complete: true };
      }
      break;
    }
  }
  return state;
}

function reducer(state: PipelineState, action: Action): PipelineState {
  switch (action.type) {
    case 'reset': return initialState();
    case 'runStarted': return { ...state, runId: action.runId, connection: 'connecting' };
    case 'connection': return { ...state, connection: action.value };
    case 'event': return reduceEvent(state, action.event);
    default: return state;
  }
}

export interface UseRunStreamResult extends PipelineState {
  start: () => void;
  started: boolean;
  error?: string;
}

export function useRunStream(bountyId: string, injectAgentId?: string): UseRunStreamResult {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const startedRef = useRef(false);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSeqRef = useRef(0);
  const completeRef = useRef(false);
  const errorRef = useRef<string | undefined>(undefined);

  // Keep refs in sync for callbacks that close over them.
  lastSeqRef.current = state.lastSeq;
  completeRef.current = state.complete;

  const cleanup = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((runId: string) => {
    // Cut off a run that never reaches a terminal status (~3 min @ 1.2s) so we
    // don't poll forever against a dead in-memory run.
    const MAX_POLLS = 150;
    let polls = 0;
    const tick = async () => {
      if (completeRef.current) return;
      if (polls++ >= MAX_POLLS) { dispatch({ type: 'connection', value: 'error' }); return; }
      try {
        const res = await fetch(`/api/runs/${runId}/events?after=${lastSeqRef.current}`);
        const body = await res.json();
        if (body.ok) {
          for (const ev of body.data.events as RunEvent[]) {
            dispatch({ type: 'event', event: ev });
          }
          if (body.data.runStatus !== 'running') {
            // Drain done — stop polling.
            return;
          }
        }
      } catch {
        dispatch({ type: 'connection', value: 'error' });
      }
      pollRef.current = setTimeout(tick, 1200);
    };
    dispatch({ type: 'connection', value: 'polling' });
    tick();
  }, []);

  const connectSSE = useCallback((runId: string, streamUrl: string) => {
    // EventSource handles Last-Event-ID auto-reconnect for us; on hard
    // failure we drop to polling.
    let opened = false;
    const es = new EventSource(streamUrl);
    esRef.current = es;

    es.onopen = () => {
      opened = true;
      dispatch({ type: 'connection', value: 'live' });
    };
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as RunEvent;
        dispatch({ type: 'event', event: ev });
        if (ev.stage === 'done') {
          // Pipeline finished — close after this event drains.
          setTimeout(() => { es.close(); esRef.current = null; }, 300);
        }
      } catch {
        /* ignore malformed frame */
      }
    };
    es.onerror = () => {
      if (completeRef.current) { es.close(); esRef.current = null; return; }
      // If we never opened, the browser may not support SSE / route blocked:
      // fall back to polling. If we had opened, show reconnecting briefly —
      // EventSource auto-retries; but to be safe we also start polling.
      es.close();
      esRef.current = null;
      dispatch({ type: 'connection', value: opened ? 'reconnecting' : 'polling' });
      startPolling(runId);
    };
  }, [startPolling]);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    dispatch({ type: 'connection', value: 'connecting' });
    api_startRun(bountyId, injectAgentId)
      .then(({ runId, streamUrl }) => {
        dispatch({ type: 'runStarted', runId });
        if (typeof window !== 'undefined' && 'EventSource' in window) {
          connectSSE(runId, streamUrl);
        } else {
          startPolling(runId);
        }
      })
      .catch((err) => {
        errorRef.current = err?.message ?? 'Failed to start run';
        dispatch({ type: 'connection', value: 'error' });
      });
  }, [bountyId, injectAgentId, connectSSE, startPolling]);

  useEffect(() => cleanup, [cleanup]);

  return { ...state, start, started: startedRef.current, error: errorRef.current };
}

// Local thin wrapper so the hook has no import cycle concerns.
async function api_startRun(bountyId: string, injectAgentId?: string): Promise<{ runId: string; streamUrl: string }> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bountyId, injectAgentId }),
  });
  const body = await res.json();
  if (!body.ok) throw new Error(body.error || 'Failed to start run');
  return body.data;
}
