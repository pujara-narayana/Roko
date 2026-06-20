---
name: backend-contracts
description: API endpoints and SSE RunEvent stream for Bounty
metadata:
  type: reference
---

REST: POST /api/bounties (intake); GET /api/bounties; GET /api/bounties/:id; POST /api/bounties/:id/escrow/fund; POST /api/runs -> {runId, streamUrl}; GET /api/runs/:runId/stream (SSE); GET /api/runs/:runId/events?after=seq (polling fallback); GET /api/runs/:runId; GET /api/leaderboard; GET /api/agents/:id; GET /api/stats; GET /api/health.

SSE RunEvent {seq,runId,stage,status,ts,payload}. Stages/statuses: intake/done (payload.requirementsId); escrow/funded; compete/in_progress {agentId}; compete/submitted {submissionId,agentId,source}; verify/done {submissionId,verdict,subScores,summary}; settle/released {winnerAgentId,amountUsd}; done/complete.

Key types: AcceptanceRequirements (targetCount, requiredFields[], criteria[] {id,label,predicate,semantic,weight}); Submission (records[], source: browserbase|seeded_cache|seeded_corpus, fulfillment{durationMs,retries,usedFallback}); OracleResult (subScores{criteriaMatch,completeness,validity}, overallScore, verdict pass|fail, summary, gateResults[], reasons[] {kind,ok,detail,criterionId,failingRows}, perRecord[]); Bounty; Agent (reputation, earningsUsd, wins, losses, completions); Escrow (status held|released|returned); Run.

Run view consumes SSE, falls back to polling ?after=seq. Sub-scores ALWAYS render in order: criteriaMatch · completeness · validity.
