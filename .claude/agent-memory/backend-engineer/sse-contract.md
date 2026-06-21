---
name: sse-contract
description: SSE event shapes, stage/status sequences, and polling fallback pattern
metadata:
  type: reference
---

Primary: GET /api/runs/:runId/stream (SSE, `text/event-stream`, `id: <seq>` for Last-Event-ID reconnect).
Fallback: GET /api/runs/:runId/events?after=<seq> (JSON polling, monotonic deduplication).

RunEvent shape: { seq: number, runId: string, stage: RunStage, status: RunStatus, ts: string, payload?: Record<string,unknown> }

Stage/status sequence:
  intake/in_progress → intake/done → escrow/funded → compete/in_progress (multiple heartbeats per agent) → compete/submitted → verify/in_progress → verify/done (one per agent) → settle/in_progress → settle/released or settle/returned → done/complete

Heartbeat: each stage emits its OWN stage name. `startHeartbeat('compete')` → `compete/in_progress {heartbeat:true}`. `startHeartbeat('verify')` → `verify/in_progress {heartbeat:true}`. This was fixed (QA Finding #4) — previously both heartbeats incorrectly emitted `stage:'compete'`.

Sub-scores in verify/done payload always in order: criteriaMatch, completeness, validity.

settle/returned payload includes amountUsd (fixed QA Finding #3, mirrors settle/released).

done/complete leaderboard array field is `reputationScore` (not `reputation`) — unified with REST /api/leaderboard shape (fixed QA Finding #9). Frontend type at lib/client/useRunStream.ts:77 must also use `reputationScore`.

oracle runOracle guard: if submissions=[] (all agents failed before call), returns {escrowAction:'return', results:[], winner:undefined, fallbackWinner:undefined} immediately — never reaches reduce. Non-empty submissions always safe for reduce (fixed QA Finding #1).
