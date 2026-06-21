/**
 * Boot-time hydration — loads persisted state from Redis into the in-memory store.
 *
 * Called from lib/seed/init.ts before the normal seed.
 * Returns true  → Redis had data; caller should skip the seed.
 * Returns false → Redis empty or not configured; caller should run the seed normally.
 *
 * SSE subscriber map is NOT hydrated (ephemeral per-process state).
 * Run events are embedded in the Run JSON blob and restore automatically.
 */

import { initRedis, getRedis } from './client';
import type {
  Bounty, Agent, Escrow, Run, Submission, OracleResult, OracleBatchResult,
} from '../types';

// ─── Generic helpers ──────────────────────────────────────────────────────────

async function getMembers(indexKey: string): Promise<string[]> {
  const redis = getRedis();
  if (!redis) return [];
  return redis.sMembers(indexKey);
}

async function hgetJson<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  const raw = await redis.hGet(key, 'data');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ─── Main hydration function ──────────────────────────────────────────────────

/**
 * Initializes Redis connection, then hydrates in-memory store from Redis.
 * store is passed in rather than imported to break a circular dependency
 * (store → mirror → client, hydrate → store would close the loop at init time).
 */
export async function hydrateFromRedis(
  store: {
    bounties: Map<string, Bounty>;
    agents: Map<string, Agent>;
    escrows: Map<string, Escrow>;
    runs: Map<string, Run>;
    submissions: Map<string, Submission>;
    oracleResults: Map<string, OracleResult>;
    oracleBatchResults: Map<string, OracleBatchResult>;
    leaderboard: {
      zadd(value: string, score: number): void;
    };
  }
): Promise<boolean> {
  // Always init first (idempotent).
  await initRedis();

  const redis = getRedis();
  if (!redis) return false;

  try {
    // ── Check if Redis has any data ─────────────────────────────────────────
    const agentIds = await getMembers('index:agents');
    if (agentIds.length === 0) {
      // Redis is empty — let the normal seed run.
      return false;
    }

    console.log(`[redis:hydrate] Found ${agentIds.length} agents — hydrating store from Redis`);

    // ── Agents ──────────────────────────────────────────────────────────────
    const agents = await Promise.all(
      agentIds.map((id) => hgetJson<Agent>(`agent:${id}`))
    );
    for (const agent of agents) {
      if (agent) store.agents.set(agent.agentId, agent);
    }

    // ── Leaderboard sorted set ──────────────────────────────────────────────
    // Restore from Redis sorted set (the real one, not computed from agents).
    const lbEntries = await redis.zRangeWithScores('leaderboard', 0, -1);
    for (const { value: agentId, score } of lbEntries) {
      store.leaderboard.zadd(agentId, score);
    }

    // ── Bounties ────────────────────────────────────────────────────────────
    const bountyIds = await getMembers('index:bounties');
    const bounties = await Promise.all(
      bountyIds.map((id) => hgetJson<Bounty>(`bounty:${id}`))
    );
    for (const bounty of bounties) {
      if (bounty) store.bounties.set(bounty.bountyId, bounty);
    }

    // ── Escrows ─────────────────────────────────────────────────────────────
    const escrowBountyIds = await getMembers('index:escrows');
    const escrows = await Promise.all(
      escrowBountyIds.map((id) => hgetJson<Escrow>(`escrow:${id}`))
    );
    for (const escrow of escrows) {
      if (escrow) store.escrows.set(escrow.bountyId, escrow);
    }

    // ── Runs ────────────────────────────────────────────────────────────────
    const runIds = await getMembers('index:runs');
    const runs = await Promise.all(
      runIds.map((id) => hgetJson<Run>(`run:${id}`))
    );
    for (const run of runs) {
      if (run) store.runs.set(run.runId, run);
    }

    // ── Submissions ─────────────────────────────────────────────────────────
    const submissionIds = await getMembers('index:submissions');
    const submissions = await Promise.all(
      submissionIds.map((id) => hgetJson<Submission>(`submission:${id}`))
    );
    for (const submission of submissions) {
      if (submission) store.submissions.set(submission.submissionId, submission);
    }

    // ── Oracle results ──────────────────────────────────────────────────────
    const oracleResultIds = await getMembers('index:oracle_results');
    const oracleResults = await Promise.all(
      oracleResultIds.map((id) => hgetJson<OracleResult>(`oracle_result:${id}`))
    );
    for (const result of oracleResults) {
      if (result) store.oracleResults.set(result.submissionId, result);
    }

    // ── Oracle batch results ────────────────────────────────────────────────
    const oracleBatchBountyIds = await getMembers('index:oracle_batches');
    const oracleBatches = await Promise.all(
      oracleBatchBountyIds.map((id) => hgetJson<OracleBatchResult>(`oracle_batch:${id}`))
    );
    for (const batch of oracleBatches) {
      if (batch) store.oracleBatchResults.set(batch.bountyId, batch);
    }

    console.log(
      `[redis:hydrate] Hydrated: ${store.bounties.size} bounties, ` +
      `${store.agents.size} agents, ${store.escrows.size} escrows, ` +
      `${store.runs.size} runs, ${store.submissions.size} submissions`
    );

    return true;
  } catch (err) {
    console.error('[redis:hydrate] Error during hydration:', err instanceof Error ? err.message : String(err));
    // On hydration failure, fall through to normal seed so the demo still works.
    return false;
  }
}
