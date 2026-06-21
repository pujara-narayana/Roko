// ─────────────────────────────────────────────
//  Bounty Marketplace — Shared TypeScript types
// ─────────────────────────────────────────────

export interface AcceptanceCriterion {
  id: string;
  label: string;
  predicate: string; // e.g. "revenue >= 1000000"
  semantic?: string; // human-readable check description
  weight: number;   // 0–1, sum should ≈ 1
}

export interface AcceptanceRequirements {
  targetCount: number;
  sector: string;
  geo: string;
  minRevenue: number;
  requiredFields: string[];
  criteria: AcceptanceCriterion[];
}

export interface CompanyRecord {
  id: string;
  name: string;
  sector: string;
  geo: string;
  revenue: number;
  vpEngEmail: string;
  vpEngName?: string;
  website?: string;
}

export type SubmissionSource = 'browserbase' | 'seeded_cache' | 'seeded_corpus';

export interface SubmissionFulfillment {
  durationMs: number;
  retries: number;
  usedFallback: boolean;
}

export interface Submission {
  submissionId: string;
  agentId: string;
  bountyId: string;
  records: CompanyRecord[];
  source: SubmissionSource;
  fulfillment: SubmissionFulfillment;
  submittedAt: string; // ISO 8601
  status: 'pending' | 'submitted' | 'failed_retrieval' | 'timed_out';
}

export interface OracleSubScores {
  criteriaMatch: number; // 0–100
  completeness: number;  // 0–100
  validity: number;      // 0–100
}

export interface OracleReason {
  kind: 'criteria' | 'completeness' | 'validity' | 'format' | 'duplicate';
  ok: boolean;
  detail: string;
  criterionId?: string;
  failingRows?: string[]; // record IDs
}

export interface GateResult {
  gate: string;
  passed: boolean;
  value: number | boolean;
  threshold?: number;
}

export interface OracleResult {
  submissionId: string;
  agentId: string;
  subScores: OracleSubScores;
  overallScore: number;   // 0–100
  verdict: 'pass' | 'fail';
  summary: string;
  gateResults: GateResult[];
  reasons: OracleReason[];
  perRecord?: Array<{ recordId: string; issues: string[] }>;
  duplicates: number;
  scoredAt: string; // ISO 8601
}

export interface OracleBatchResult {
  bountyId: string;
  results: OracleResult[];
  fallbackWinner?: string; // agentId — set when no submission passes
  escrowAction: 'release' | 'return';
  winner?: string; // agentId
}

export type EscrowStatus = 'held' | 'released' | 'returned';

export interface Escrow {
  escrowId: string;
  bountyId: string;
  amountUsd: number;
  status: EscrowStatus;
  fundedAt: string;
  settledAt?: string;
  releasedTo?: string;  // agentId
  returnedTo?: string;  // 'poster'
}

export type BountyStatus = 'open' | 'in_progress' | 'settled' | 'failed';

export interface Bounty {
  bountyId: string;
  title: string;
  description: string;
  category: string;
  reward: number;
  poster: string;
  status: BountyStatus;
  requirements?: AcceptanceRequirements;
  requirementsId?: string;
  escrowId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  agentId: string;
  name: string;
  model: string;
  description: string;
  reputation: number;     // 0–1000 points
  earningsUsd: number;
  wins: number;
  losses: number;
  completions: number;
  passRate: number;       // 0–100
  avgCriteriaMatch: number;
  avgCompleteness: number;
  avgValidity: number;
  lastActive?: string;
}

export type RunStage = 'intake' | 'escrow' | 'compete' | 'verify' | 'settle' | 'done';
export type RunStatus = 'in_progress' | 'submitted' | 'done' | 'failed' | 'funded' | 'released' | 'returned' | 'complete';

export interface RunEvent {
  seq: number;
  runId: string;
  stage: RunStage;
  status: RunStatus;
  ts: string; // ISO 8601
  payload?: Record<string, unknown>;
}

export interface Run {
  runId: string;
  bountyId: string;
  streamUrl: string;
  status: 'running' | 'complete' | 'failed';
  startedAt: string;
  completedAt?: string;
  events: RunEvent[];
}

// ─── API response wrappers ────────────────────

export interface ApiOk<T> {
  ok: true;
  data: T;
}

export interface ApiErr {
  ok: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ─── Stats ────────────────────────────────────

export interface PlatformStats {
  totalBounties: number;
  totalAgents: number;
  totalEscrowUsd: number;
  avgVerificationMs: number;
  totalSettled: number;
}
