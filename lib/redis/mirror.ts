/**
 * Redis write-through mirror.
 *
 * All functions are fire-and-forget: they return void Promises and never throw.
 * Call them after every in-memory write without await (or with .catch(() => {})).
 *
 * Key scheme:
 *   bounty:{bountyId}              — Hash, field "data", JSON-serialized Bounty
 *   agent:{agentId}                — Hash, field "data", JSON-serialized Agent
 *   escrow:{bountyId}              — Hash, field "data", JSON-serialized Escrow
 *   run:{runId}                    — Hash, field "data", JSON-serialized Run
 *   submission:{submissionId}      — Hash, field "data", JSON-serialized Submission
 *   oracle_result:{submissionId}   — Hash, field "data", JSON-serialized OracleResult
 *   oracle_batch:{bountyId}        — Hash, field "data", JSON-serialized OracleBatchResult
 *   leaderboard                    — Sorted Set, member=agentId, score=reputation
 *   index:bounties                 — Set, all bountyIds
 *   index:agents                   — Set, all agentIds
 *   index:escrows                  — Set, all bountyIds (keyed to escrow)
 *   index:runs                     — Set, all runIds
 *   index:submissions              — Set, all submissionIds
 *   index:oracle_results           — Set, all submissionIds
 *   index:oracle_batches           — Set, all bountyIds (keyed to oracle batch)
 */

import { getRedis } from './client';
import type {
  Bounty, Agent, Escrow, Run, Submission, OracleResult, OracleBatchResult,
} from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hset(key: string, value: unknown): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.hSet(key, 'data', JSON.stringify(value));
}

async function sadd(key: string, member: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.sAdd(key, member);
}

// ─── Per-entity mirror functions ──────────────────────────────────────────────

export async function mirrorBounty(bounty: Bounty): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`bounty:${bounty.bountyId}`, bounty),
      sadd('index:bounties', bounty.bountyId),
    ]);
  } catch (err) {
    console.error('[redis:mirror] bounty error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorAgent(agent: Agent): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`agent:${agent.agentId}`, agent),
      sadd('index:agents', agent.agentId),
      // Real sorted-set: ZADD replaces score atomically.
      redis.zAdd('leaderboard', { score: agent.reputation, value: agent.agentId }),
    ]);
  } catch (err) {
    console.error('[redis:mirror] agent error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorReputation(agentId: string, score: number): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    // ZADD with the canonical in-memory score (no double-counting).
    await redis.zAdd('leaderboard', { score, value: agentId });
  } catch (err) {
    console.error('[redis:mirror] reputation error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorEscrow(escrow: Escrow): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`escrow:${escrow.bountyId}`, escrow),
      sadd('index:escrows', escrow.bountyId),
    ]);
  } catch (err) {
    console.error('[redis:mirror] escrow error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorRun(run: Run): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`run:${run.runId}`, run),
      sadd('index:runs', run.runId),
    ]);
  } catch (err) {
    console.error('[redis:mirror] run error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorSubmission(submission: Submission): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`submission:${submission.submissionId}`, submission),
      sadd('index:submissions', submission.submissionId),
    ]);
  } catch (err) {
    console.error('[redis:mirror] submission error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorOracleResult(result: OracleResult): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    await Promise.all([
      hset(`oracle_result:${result.submissionId}`, result),
      sadd('index:oracle_results', result.submissionId),
    ]);
  } catch (err) {
    console.error('[redis:mirror] oracle_result error:', err instanceof Error ? err.message : String(err));
  }
}

export async function mirrorOracleBatch(batch: OracleBatchResult): Promise<void> {
  try {
    const redis = getRedis();
    if (!redis) return;
    // Also mirror each individual result within the batch.
    await Promise.all([
      hset(`oracle_batch:${batch.bountyId}`, batch),
      sadd('index:oracle_batches', batch.bountyId),
      ...batch.results.map((r) => mirrorOracleResult(r)),
    ]);
  } catch (err) {
    console.error('[redis:mirror] oracle_batch error:', err instanceof Error ? err.message : String(err));
  }
}
