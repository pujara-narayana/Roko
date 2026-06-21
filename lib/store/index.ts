/**
 * In-memory store — synchronous source of truth.
 * Redis is a write-through mirror (fire-and-forget) and provides boot-time hydration.
 * Singleton module. All state lives here for the demo path.
 * Supports sorted sets for the leaderboard (like Redis ZADD/ZRANGE).
 */

import type {
  Bounty, Agent, Escrow, Run, RunEvent,
  Submission, OracleResult, OracleBatchResult,
} from '../types';
import {
  mirrorBounty, mirrorAgent, mirrorReputation, mirrorEscrow,
  mirrorRun, mirrorSubmission, mirrorOracleResult, mirrorOracleBatch,
} from '../redis/mirror';

// ─── Sorted-set helper (simulates Redis sorted set) ───────────────────────────

class SortedSet<T extends { score: number; value: string }> {
  private items: Map<string, number> = new Map();

  zadd(value: string, score: number) {
    this.items.set(value, score);
  }

  zincrby(value: string, by: number) {
    const cur = this.items.get(value) ?? 0;
    this.items.set(value, cur + by);
    return cur + by;
  }

  zrevrange(): string[] {
    return [...this.items.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([v]) => v);
  }

  zscore(value: string): number | undefined {
    return this.items.get(value);
  }

  zrank(value: string): number {
    const sorted = this.zrevrange();
    const idx = sorted.indexOf(value);
    return idx === -1 ? -1 : idx + 1; // 1-based rank
  }
}

// ─── In-memory store ──────────────────────────────────────────────────────────

class InMemoryStore {
  bounties = new Map<string, Bounty>();
  agents = new Map<string, Agent>();
  escrows = new Map<string, Escrow>();
  runs = new Map<string, Run>();
  submissions = new Map<string, Submission>();
  oracleResults = new Map<string, OracleResult>();
  oracleBatchResults = new Map<string, OracleBatchResult>();

  // leaderboard sorted set: agentId → reputation score
  leaderboard = new SortedSet<{ score: number; value: string }>();

  // SSE subscriber lists: runId → array of controller callbacks
  private sseSubscribers = new Map<string, Array<(event: RunEvent) => void>>();

  // ── Bounty ops ──────────────────────────────────────────────────────────────

  setBounty(b: Bounty) {
    this.bounties.set(b.bountyId, b);
    mirrorBounty(b).catch(() => {});
  }

  getBounty(id: string): Bounty | undefined {
    return this.bounties.get(id);
  }

  listBounties(): Bounty[] {
    return [...this.bounties.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // ── Agent ops ───────────────────────────────────────────────────────────────

  setAgent(a: Agent) {
    this.agents.set(a.agentId, a);
    this.leaderboard.zadd(a.agentId, a.reputation);
    mirrorAgent(a).catch(() => {});
  }

  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  listAgentsByReputation(): Agent[] {
    return this.leaderboard
      .zrevrange()
      .map(id => this.agents.get(id))
      .filter((a): a is Agent => !!a);
  }

  incrementReputation(agentId: string, by: number) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    agent.reputation = Math.max(0, agent.reputation + by);
    this.leaderboard.zadd(agentId, agent.reputation);
    // Mirror canonical score (not a delta) — avoids double-counting if retried.
    mirrorReputation(agentId, agent.reputation).catch(() => {});
    // Also mirror the full agent hash so agent:{id} stays consistent with
    // the leaderboard sorted set. Without this the hash retains the stale
    // pre-increment reputation after a process restart.
    mirrorAgent(agent).catch(() => {});
  }

  // ── Escrow ops ──────────────────────────────────────────────────────────────

  setEscrow(e: Escrow) {
    this.escrows.set(e.bountyId, e);
    mirrorEscrow(e).catch(() => {});
  }

  getEscrow(bountyId: string): Escrow | undefined {
    return this.escrows.get(bountyId);
  }

  // ── Run ops ─────────────────────────────────────────────────────────────────

  setRun(r: Run) {
    this.runs.set(r.runId, r);
    mirrorRun(r).catch(() => {});
  }

  getRun(id: string): Run | undefined {
    return this.runs.get(id);
  }

  appendEvent(runId: string, event: RunEvent) {
    const run = this.runs.get(runId);
    if (!run) return;
    run.events.push(event);
    // Mirror the updated Run (with the new event appended) to Redis.
    mirrorRun(run).catch(() => {});
    // notify SSE subscribers
    const subs = this.sseSubscribers.get(runId) ?? [];
    for (const cb of subs) {
      try { cb(event); } catch { /* ignore closed subscribers */ }
    }
  }

  subscribeSSE(runId: string, cb: (event: RunEvent) => void): () => void {
    if (!this.sseSubscribers.has(runId)) {
      this.sseSubscribers.set(runId, []);
    }
    this.sseSubscribers.get(runId)!.push(cb);
    return () => {
      const subs = this.sseSubscribers.get(runId) ?? [];
      const idx = subs.indexOf(cb);
      if (idx !== -1) subs.splice(idx, 1);
    };
  }

  // ── Submission ops ──────────────────────────────────────────────────────────

  setSubmission(s: Submission) {
    this.submissions.set(s.submissionId, s);
    mirrorSubmission(s).catch(() => {});
  }

  getSubmission(id: string): Submission | undefined {
    return this.submissions.get(id);
  }

  // ── Oracle result ops ───────────────────────────────────────────────────────

  setOracleResult(r: OracleResult) {
    this.oracleResults.set(r.submissionId, r);
    mirrorOracleResult(r).catch(() => {});
  }

  setOracleBatch(r: OracleBatchResult) {
    this.oracleBatchResults.set(r.bountyId, r);
    mirrorOracleBatch(r).catch(() => {});
  }

  getOracleBatch(bountyId: string): OracleBatchResult | undefined {
    return this.oracleBatchResults.get(bountyId);
  }
}

// Singleton
const store = new InMemoryStore();
export default store;
export { InMemoryStore };
