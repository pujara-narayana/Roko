/**
 * Agent competition runner.
 * Runs 3 agents in parallel against the hero bounty using seeded corpora.
 * Each agent has auto-retry (once) and a hard timeout.
 */

import { v4 as uuid } from 'uuid';
import type {
  Submission, AcceptanceRequirements, RunEvent, Agent,
} from '../types';
import store from '../store';
import {
  getAlphaRecords, getBetaRecords, getCharlieRecords,
} from '../seed/fixtures';
import { persistSubmission } from '../persist';

const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '90000', 10);

// ─── Per-agent corpus loaders ─────────────────────────────────────────────────

function loadCorpus(agentId: string) {
  switch (agentId) {
    case 'agent-alpha':   return getAlphaRecords();
    case 'agent-beta':    return getBetaRecords();
    case 'agent-charlie': return getCharlieRecords();
    default:              return getCharlieRecords();
  }
}

// ─── Simulated work logs per agent ────────────────────────────────────────────

const AGENT_LOG_LINES: Record<string, string[]> = {
  'agent-alpha': [
    'Querying Browserbase for fintech companies…',
    'Found 17 candidate companies…',
    'Enriching contacts with Hunter.io…',
    'Validating revenue data…',
    'Submitting 17 results…',
  ],
  'agent-beta': [
    'Searching Crunchbase for US fintech…',
    'Found 20 candidates matching sector…',
    'Scraping VP-of-Engineering contacts…',
    'Running email format checks…',
    'Submitting 20 results…',
  ],
  'agent-charlie': [
    'Querying verified company database…',
    'Found 20 matches meeting all criteria…',
    'Cross-referencing MX records for each email…',
    'Deduplication check complete — 0 duplicates…',
    'Submitting 20 verified results…',
  ],
};

// ─── Simulated agent work (deterministic, no real API calls) ──────────────────

async function simulateAgentWork(
  agentId: string,
  bountyId: string,
  runId: string,
  emitEvent: (e: Omit<RunEvent, 'seq' | 'runId'>) => void,
  attempt: number = 1,
): Promise<Submission> {
  const submissionId = uuid();
  const startedAt = Date.now();

  // Simulate progressive log emission
  const logLines = AGENT_LOG_LINES[agentId] ?? AGENT_LOG_LINES['agent-charlie'];

  // Emit "working" heartbeat events with log lines
  const delays = agentId === 'agent-alpha'
    ? [500, 1200, 800, 600, 400]   // slightly faster (cheats on coverage)
    : agentId === 'agent-beta'
      ? [600, 900, 700, 500, 300]
      : [700, 1000, 900, 600, 400]; // charlie: careful & thorough

  for (let i = 0; i < logLines.length; i++) {
    await sleep(delays[i] ?? 500);
    emitEvent({
      stage: 'compete',
      status: 'in_progress',
      ts: now(),
      payload: {
        agentId,
        logLine: logLines[i],
        progressStep: i + 1,
        totalSteps: logLines.length,
      },
    });
  }

  const records = loadCorpus(agentId);
  const durationMs = Date.now() - startedAt;

  const submission: Submission = {
    submissionId,
    agentId,
    bountyId,
    records,
    source: 'seeded_corpus',
    fulfillment: {
      durationMs,
      retries: attempt - 1,
      usedFallback: false,
    },
    submittedAt: now(),
    status: 'submitted',
  };

  return submission;
}

// ─── Run one agent with timeout + auto-retry ──────────────────────────────────

async function runAgent(
  agent: Agent,
  bountyId: string,
  runId: string,
  emitEvent: (e: Omit<RunEvent, 'seq' | 'runId'>) => void,
): Promise<Submission> {
  const { agentId } = agent;

  emitEvent({
    stage: 'compete',
    status: 'in_progress',
    ts: now(),
    payload: { agentId, logLine: 'Agent starting…', progressStep: 0, totalSteps: 5 },
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await Promise.race([
        simulateAgentWork(agentId, bountyId, runId, emitEvent, attempt),
        timeoutReject(AGENT_TIMEOUT_MS, `${agentId} timed out`),
      ]) as Submission;

      // Persist to disk
      await persistSubmission(runId, result);

      // Store in memory
      store.setSubmission(result);

      emitEvent({
        stage: 'compete',
        status: 'submitted',
        ts: now(),
        payload: {
          submissionId: result.submissionId,
          agentId,
          source: result.source,
          recordCount: result.records.length,
        },
      });

      return result;
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timed out');
      const errMsg = err instanceof Error ? err.message : String(err);

      if (isTimeout) {
        const submission: Submission = {
          submissionId: uuid(),
          agentId,
          bountyId,
          records: [],
          source: 'seeded_corpus',
          fulfillment: { durationMs: AGENT_TIMEOUT_MS, retries: attempt - 1, usedFallback: false },
          submittedAt: now(),
          status: 'timed_out',
        };
        store.setSubmission(submission);
        emitEvent({
          stage: 'compete',
          status: 'in_progress',
          ts: now(),
          payload: { agentId, logLine: `TIMED_OUT after ${AGENT_TIMEOUT_MS}ms`, error: errMsg },
        });
        return submission;
      }

      if (attempt < 2) {
        // Retry once
        emitEvent({
          stage: 'compete',
          status: 'in_progress',
          ts: now(),
          payload: { agentId, logLine: `Error — retrying (attempt ${attempt + 1})…`, error: errMsg },
        });
        await sleep(500);
      } else {
        // Second failure — mark as failed
        const submission: Submission = {
          submissionId: uuid(),
          agentId,
          bountyId,
          records: [],
          source: 'seeded_corpus',
          fulfillment: { durationMs: Date.now() - Date.now(), retries: 1, usedFallback: false },
          submittedAt: now(),
          status: 'failed_retrieval',
        };
        store.setSubmission(submission);
        emitEvent({
          stage: 'compete',
          status: 'in_progress',
          ts: now(),
          payload: { agentId, logLine: `Failed after 2 attempts: ${errMsg}` },
        });
        return submission;
      }
    }
  }

  // Should not reach here
  throw new Error(`Unexpected end of runAgent for ${agentId}`);
}

// ─── Run all 3 agents in parallel ─────────────────────────────────────────────

export async function runCompetition(
  bountyId: string,
  runId: string,
  emitEvent: (e: Omit<RunEvent, 'seq' | 'runId'>) => void,
): Promise<Submission[]> {
  const agents = [
    store.getAgent('agent-alpha'),
    store.getAgent('agent-beta'),
    store.getAgent('agent-charlie'),
  ].filter((a): a is Agent => !!a);

  // All 3 run in parallel
  const submissions = await Promise.all(
    agents.map(agent => runAgent(agent, bountyId, runId, emitEvent))
  );

  return submissions;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function now() {
  return new Date().toISOString();
}

function timeoutReject(ms: number, msg: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}
