/**
 * Hero loop pipeline orchestrator.
 * POST → COMPETE → VERIFY → SETTLE
 *
 * Runs asynchronously in the background after a run is created.
 * Emits RunEvents throughout via the SSE emitter.
 */

import { v4 as uuid } from 'uuid';
import type { Bounty, Run, RunStage } from './types';
import store from './store';
import { createEmitter } from './sse';
import { runCompetition, planCompetitors } from './agents';
import { runOracle } from './oracle';
import { releaseEscrow, returnEscrow, fundEscrow } from './escrow';
import { persistRequirements } from './persist';
import { HERO_REQUIREMENTS } from './seed/fixtures';

const HEARTBEAT_INTERVAL_MS = 8_000; // 8s heartbeat

// ─── Create and start a new run ───────────────────────────────────────────────

export function createRun(bounty: Bounty): Run {
  const runId = uuid();
  const run: Run = {
    runId,
    bountyId: bounty.bountyId,
    streamUrl: `/api/runs/${runId}/stream`,
    status: 'running',
    startedAt: new Date().toISOString(),
    events: [],
  };
  store.setRun(run);
  return run;
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function executePipeline(run: Run, bounty: Bounty): Promise<void> {
  const { runId, bountyId } = run;
  const emit = createEmitter(runId);
  let heartbeatTimer: NodeJS.Timeout | null = null;

  // Helper: heartbeat so SSE never goes silent for > 10s
  // Emits the currently-active stage so the reducer does not re-activate a completed pip.
  function startHeartbeat(activeStage: string) {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      emit({
        stage: activeStage as RunStage,
        status: 'in_progress',
        ts: new Date().toISOString(),
        payload: { heartbeat: true, currentStage: activeStage },
      });
    }, HEARTBEAT_INTERVAL_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  try {
    // ── INTAKE / POST stage ─────────────────────────────────────────────────
    emit({
      stage: 'intake',
      status: 'in_progress',
      ts: new Date().toISOString(),
      payload: { message: 'Compiling acceptance requirements…' },
    });

    await sleep(600); // simulate intake agent thinking

    const requirements = bounty.requirements ?? HERO_REQUIREMENTS;
    await persistRequirements(runId, bountyId, requirements);

    emit({
      stage: 'intake',
      status: 'done',
      ts: new Date().toISOString(),
      payload: {
        requirementsId: bounty.requirementsId ?? `req-${bountyId}`,
        targetCount: requirements.targetCount,
        sector: requirements.sector,
        criteriaCount: requirements.criteria.length,
      },
    });

    // ── ESCROW stage ────────────────────────────────────────────────────────
    const escrow = fundEscrow(bountyId, bounty.reward);
    emit({
      stage: 'escrow',
      status: 'funded',
      ts: new Date().toISOString(),
      payload: {
        escrowId: escrow.escrowId,
        amountUsd: escrow.amountUsd,
        status: escrow.status,
      },
    });

    await sleep(400);

    // ── Update bounty status ────────────────────────────────────────────────
    const updatedBounty = { ...bounty, status: 'in_progress' as const, updatedAt: new Date().toISOString() };
    store.setBounty(updatedBounty);

    // ── COMPETE stage ───────────────────────────────────────────────────────
    const plan = planCompetitors(bounty.taskType ?? 'data-research');
    emit({
      stage: 'compete',
      status: 'in_progress',
      ts: new Date().toISOString(),
      payload: {
        message: `Dispatching ${plan.length} ${plan.length === 1 ? 'agent' : 'agents'}…`,
        agentCount: plan.length,
        agentIds: plan.map((p) => p.agent.agentId),
      },
    });

    startHeartbeat('compete');

    const submissions = await runCompetition(bounty, runId, (e) => {
      emit(e as Parameters<typeof emit>[0]);
    });

    stopHeartbeat();

    // A media task with no provider key produces awaiting-key submissions —
    // surface the provider so the client shows the "waiting for the key" popup.
    const awaitingKey = submissions.find((s) => s.fulfillment.awaitingKey)?.fulfillment.awaitingKey ?? null;

    emit({
      stage: 'compete',
      status: 'submitted',
      ts: new Date().toISOString(),
      payload: {
        submissionCount: submissions.length,
        submissionIds: submissions.map(s => s.submissionId),
        awaitingKey,
      },
    });

    await sleep(300);

    // ── VERIFY stage ────────────────────────────────────────────────────────
    emit({
      stage: 'verify',
      status: 'in_progress',
      ts: new Date().toISOString(),
      payload: { message: 'Oracle running verification checks…', submissionCount: submissions.length },
    });

    startHeartbeat('verify');

    // Score each submission, emit per-agent verdict
    const oracleResults = [];
    for (const submission of submissions) {
      await sleep(500); // simulate oracle processing time

      emit({
        stage: 'verify',
        status: 'in_progress',
        ts: new Date().toISOString(),
        payload: { message: `Checking ${submission.agentId}…`, agentId: submission.agentId },
      });

      await sleep(300);
    }

    // Run oracle (deterministic data checks, or Claude-judge for deliverables)
    const batchResult = await runOracle(bounty, runId, submissions);
    store.setOracleBatch(batchResult);

    stopHeartbeat();

    // Emit per-submission verdicts
    for (const result of batchResult.results) {
      emit({
        stage: 'verify',
        status: 'done',
        ts: new Date().toISOString(),
        payload: {
          submissionId: result.submissionId,
          agentId: result.agentId,
          verdict: result.verdict,
          subScores: result.subScores,
          overallScore: result.overallScore,
          summary: result.summary,
          reasons: result.reasons,
          gateResults: result.gateResults,
          duplicates: result.duplicates,
        },
      });
      await sleep(200);
    }

    await sleep(300);

    // ── SETTLE stage ────────────────────────────────────────────────────────
    emit({
      stage: 'settle',
      status: 'in_progress',
      ts: new Date().toISOString(),
      payload: {
        escrowAction: batchResult.escrowAction,
        winner: batchResult.winner,
        fallbackWinner: batchResult.fallbackWinner,
      },
    });

    await sleep(800); // let the animation play

    let settledEscrow;
    if (batchResult.winner) {
      settledEscrow = releaseEscrow(bountyId, batchResult.winner);
      emit({
        stage: 'settle',
        status: 'released',
        ts: new Date().toISOString(),
        payload: {
          winnerAgentId: batchResult.winner,
          amountUsd: settledEscrow.amountUsd,
          transactionId: `tx-${uuid().slice(0, 8)}`,
        },
      });
    } else {
      settledEscrow = returnEscrow(bountyId);
      emit({
        stage: 'settle',
        status: 'returned',
        ts: new Date().toISOString(),
        payload: {
          fallbackWinner: batchResult.fallbackWinner,
          returnedTo: 'poster',
          amountUsd: settledEscrow.amountUsd,
          transactionId: `tx-${uuid().slice(0, 8)}`,
        },
      });
    }

    // Update bounty final status
    const finalBounty = {
      ...updatedBounty,
      status: (batchResult.winner ? 'settled' : 'failed') as 'settled' | 'failed',
      updatedAt: new Date().toISOString(),
    };
    store.setBounty(finalBounty);

    // ── DONE ────────────────────────────────────────────────────────────────
    emit({
      stage: 'done',
      status: 'complete',
      ts: new Date().toISOString(),
      payload: {
        winner: batchResult.winner,
        fallbackWinner: batchResult.fallbackWinner,
        escrowAction: batchResult.escrowAction,
        awaitingKey,
        leaderboard: store.listAgentsByReputation().slice(0, 5).map(a => ({
          agentId: a.agentId,
          name: a.name,
          reputationScore: a.reputation,
        })),
      },
    });

    const completedRun = store.getRun(runId);
    if (completedRun) {
      completedRun.status = 'complete';
      completedRun.completedAt = new Date().toISOString();
      store.setRun(completedRun);
    }

  } catch (err) {
    stopHeartbeat();
    console.error('[pipeline] Unhandled error:', err);
    emit({
      stage: 'done',
      status: 'failed',
      ts: new Date().toISOString(),
      payload: { error: err instanceof Error ? err.message : String(err) },
    });
    const failedRun = store.getRun(runId);
    if (failedRun) {
      failedRun.status = 'failed';
      store.setRun(failedRun);
    }
  }
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
