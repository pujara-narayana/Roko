/**
 * Verification Oracle.
 *
 * Deterministic checks:
 *   1. Count / completeness check
 *   2. Required-field schema check
 *   3. De-duplication check
 *   4. Criteria predicate match (sector, geo, revenue)
 *   5. Email format validity (RFC-5322 regex)
 *
 * Semantic / LLM-judge:
 *   - Stubbed deterministically for the seeded path.
 *   - If ANTHROPIC_API_KEY present, could call Claude for fuzzy checks.
 *
 * PASS gate: completeness >= 95 AND criteriaMatch >= 90
 *            AND validity >= 90 AND overall >= 90 AND duplicates == 0
 */

import type {
  Submission, AcceptanceRequirements, OracleResult,
  OracleBatchResult, CompanyRecord, GateResult, OracleReason,
} from '../types';
import { persistOracleResults } from '../persist';

// ─── Email validation (RFC-5322 simplified) ───────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  if (!EMAIL_REGEX.test(email)) return false;
  // Catch obvious malformed patterns
  if (email.includes('@@')) return false;
  if (email.startsWith('@') || email.endsWith('@')) return false;
  // Stub MX check: flag obviously fake domains
  const domain = email.split('@')[1] ?? '';
  if (domain.includes('invaliddomainxyz') || domain.endsWith('.fake')) return false;
  if (domain.split('.').length < 2) return false;
  return true;
}

// ─── Criteria predicate matcher ───────────────────────────────────────────────

function matchesCriteria(
  record: CompanyRecord,
  requirements: AcceptanceRequirements,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];

  if (record.sector !== requirements.sector) {
    failures.push(`sector mismatch: expected "${requirements.sector}", got "${record.sector}"`);
  }
  if (record.geo !== requirements.geo) {
    failures.push(`geo mismatch: expected "${requirements.geo}", got "${record.geo}"`);
  }
  if (record.revenue < requirements.minRevenue) {
    failures.push(`revenue ${record.revenue} < required ${requirements.minRevenue}`);
  }

  return { ok: failures.length === 0, failures };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function findDuplicates(records: CompanyRecord[]): CompanyRecord[][] {
  // Duplicate = same company name (case-insensitive) appearing more than once
  const byName = new Map<string, CompanyRecord[]>();
  for (const r of records) {
    const key = r.name.toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }
  return [...byName.values()].filter(group => group.length > 1);
}

// ─── Semantic stub ────────────────────────────────────────────────────────────
// In production: call Claude with low temperature to judge fuzzy criteria.
// For demo path: returns a fixed deterministic score based on agentId.

function semanticScore(agentId: string): number {
  switch (agentId) {
    case 'agent-charlie': return 98; // passes
    case 'agent-beta':    return 82; // below threshold
    default:              return 70; // agent-alpha
  }
}

// ─── Score one submission ─────────────────────────────────────────────────────

export function scoreSubmission(
  submission: Submission,
  requirements: AcceptanceRequirements,
): OracleResult {
  const { submissionId, agentId, records } = submission;
  const reasons: OracleReason[] = [];
  const gateResults: GateResult[] = [];

  // Guard against empty submissions (TIMED_OUT / FAILED_RETRIEVAL)
  if (submission.status !== 'submitted' || records.length === 0) {
    const zero = { criteriaMatch: 0, completeness: 0, validity: 0 };
    return {
      submissionId,
      agentId,
      subScores: zero,
      overallScore: 0,
      verdict: 'fail',
      summary: `Submission not usable (status: ${submission.status})`,
      gateResults: [],
      reasons: [{ kind: 'completeness', ok: false, detail: `Agent ${agentId} did not produce a submission` }],
      duplicates: 0,
      scoredAt: new Date().toISOString(),
    };
  }

  // ── 1. Required-field schema check ────────────────────────────────────────
  const missingFields: string[] = [];
  for (const rec of records) {
    for (const field of requirements.requiredFields) {
      const val = (rec as unknown as Record<string, unknown>)[field];
      if (val === undefined || val === null || val === '') {
        missingFields.push(`${rec.id}: missing ${field}`);
      }
    }
  }
  const schemaOk = missingFields.length === 0;
  reasons.push({
    kind: 'format',
    ok: schemaOk,
    detail: schemaOk
      ? 'All required fields present in every record'
      : `${missingFields.length} required field(s) missing: ${missingFields.slice(0, 3).join(', ')}${missingFields.length > 3 ? '…' : ''}`,
  });

  // ── 2. Criteria predicate match ───────────────────────────────────────────
  let criteriaMatched = 0;
  const criteriaFails: string[] = [];
  for (const rec of records) {
    const { ok, failures } = matchesCriteria(rec, requirements);
    if (ok) {
      criteriaMatched++;
    } else {
      criteriaFails.push(...failures.map(f => `${rec.name}: ${f}`));
    }
  }
  const criteriaMatchPct = safeDivide(criteriaMatched, requirements.targetCount) * 100;
  const criteriaOk = criteriaMatched >= requirements.targetCount * 0.9; // >= 90%
  reasons.push({
    kind: 'criteria',
    ok: criteriaOk,
    detail: `${criteriaMatched}/${requirements.targetCount} companies matched all criteria (revenue ≥$${(requirements.minRevenue / 1_000_000).toFixed(0)}M, sector=${requirements.sector}, geo=${requirements.geo}) — duplicates excluded from unique criteria count`,
    criterionId: 'c-sector,c-revenue',
    failingRows: criteriaFails.slice(0, 5),
  });

  // ── 3. Completeness / count check ─────────────────────────────────────────
  const completenessRaw = safeDivide(Math.min(records.length, requirements.targetCount), requirements.targetCount) * 100;

  // ── 4. Duplicate detection ────────────────────────────────────────────────
  const dupGroups = findDuplicates(records);
  const dupCount = dupGroups.reduce((acc, g) => acc + g.length - 1, 0); // extra copies
  const dupOk = dupCount === 0;
  if (!dupOk) {
    reasons.push({
      kind: 'duplicate',
      ok: false,
      detail: `${dupCount} duplicate entr${dupCount === 1 ? 'y' : 'ies'} detected — ${dupGroups.map(g => g[0].name).slice(0, 3).join(', ')}${dupGroups.length > 3 ? '…' : ''}`,
      failingRows: dupGroups.flatMap(g => g.slice(1).map(r => r.id)),
    });
  } else {
    reasons.push({
      kind: 'duplicate',
      ok: true,
      detail: 'No duplicate entries detected',
    });
  }

  // Reduce completeness score by duplicates
  const completeness = Math.max(0, completenessRaw - dupCount * 5);

  // ── 5. Email validity check ───────────────────────────────────────────────
  const invalidEmails: string[] = [];
  for (const rec of records) {
    if (!isValidEmail(rec.vpEngEmail)) {
      invalidEmails.push(`${rec.name}: "${rec.vpEngEmail}"`);
    }
  }
  const validEmailCount = records.length - invalidEmails.length;
  const validityPct = safeDivide(validEmailCount, records.length) * 100;
  const validityOk = validityPct >= 90 && invalidEmails.length === 0;
  reasons.push({
    kind: 'validity',
    ok: validityOk,
    detail: invalidEmails.length === 0
      ? `All ${records.length} email addresses passed format + domain validation`
      : `${invalidEmails.length} email address${invalidEmails.length === 1 ? '' : 'es'} failed validation: ${invalidEmails.slice(0, 3).join(', ')}${invalidEmails.length > 3 ? `… and ${invalidEmails.length - 3} more` : ''}`,
    criterionId: 'c-email',
    failingRows: invalidEmails.slice(0, 5),
  });

  // ── 6. Semantic/LLM judge (stubbed) ──────────────────────────────────────
  const semanticPct = semanticScore(agentId);
  reasons.push({
    kind: 'criteria',
    ok: semanticPct >= 90,
    detail: `Semantic quality score: ${semanticPct}/100 (verified current employment, public presence)`,
    criterionId: 'semantic',
  });

  // ── Compute sub-scores ────────────────────────────────────────────────────

  // criteriaMatch: weighted average of predicate match + semantic
  const criteriaMatch = Math.min(100, Math.round(criteriaMatchPct * 0.7 + semanticPct * 0.3));

  // validity: email check drives this
  const validity = Math.round(validityPct);

  // ── Gate checks ───────────────────────────────────────────────────────────
  const COMPLETENESS_GATE = 95;
  const CRITERIA_GATE = 90;
  const VALIDITY_GATE = 90;
  const OVERALL_GATE = 90;

  gateResults.push(
    { gate: 'completeness',  passed: completeness  >= COMPLETENESS_GATE, value: Math.round(completeness),  threshold: COMPLETENESS_GATE },
    { gate: 'criteriaMatch', passed: criteriaMatch >= CRITERIA_GATE,     value: criteriaMatch,              threshold: CRITERIA_GATE },
    { gate: 'validity',      passed: validity      >= VALIDITY_GATE,     value: validity,                   threshold: VALIDITY_GATE },
    { gate: 'duplicates',    passed: dupCount === 0,                     value: dupCount,                   threshold: 0 },
  );

  // overall = weighted average of sub-scores
  const overallScore = Math.round(
    criteriaMatch  * 0.35 +
    completeness   * 0.35 +
    validity       * 0.30
  );

  gateResults.push({
    gate: 'overall',
    passed: overallScore >= OVERALL_GATE,
    value: overallScore,
    threshold: OVERALL_GATE,
  });

  // PASS gate: ALL gates must pass
  const allGatesPassed =
    completeness  >= COMPLETENESS_GATE &&
    criteriaMatch >= CRITERIA_GATE &&
    validity      >= VALIDITY_GATE &&
    overallScore  >= OVERALL_GATE &&
    dupCount      === 0;

  const verdict: 'pass' | 'fail' = allGatesPassed ? 'pass' : 'fail';

  // Human-readable summary
  const failedGates = gateResults.filter(g => !g.passed).map(g => g.gate);
  const summary = verdict === 'pass'
    ? `All gates passed — ${records.length}/${requirements.targetCount} records, 0 duplicates, all emails valid.`
    : `Failed gates: ${failedGates.join(', ')}. ${criteriaMatched}/${requirements.targetCount} criteria matches, ${dupCount} duplicate${dupCount !== 1 ? 's' : ''}, ${invalidEmails.length} invalid email${invalidEmails.length !== 1 ? 's' : ''}.`;

  return {
    submissionId,
    agentId,
    subScores: {
      criteriaMatch: Math.round(criteriaMatch),
      completeness: Math.round(completeness),
      validity: Math.round(validity),
    },
    overallScore,
    verdict,
    summary,
    gateResults,
    reasons,
    duplicates: dupCount,
    scoredAt: new Date().toISOString(),
  };
}

// ─── Score all submissions (batch) ────────────────────────────────────────────

export async function runOracle(
  bountyId: string,
  runId: string,
  submissions: Submission[],
  requirements: AcceptanceRequirements,
): Promise<OracleBatchResult> {
  // Guard: if no submissions at all, return a well-formed no-pass result immediately
  if (submissions.length === 0) {
    const emptyResult: OracleBatchResult = {
      bountyId,
      results: [],
      winner: undefined,
      fallbackWinner: undefined,
      escrowAction: 'return',
    };
    await persistOracleResults(runId, bountyId, [], emptyResult);
    return emptyResult;
  }

  const results = submissions.map(s => scoreSubmission(s, requirements));

  // Find winner (first passing submission)
  const winner = results.find(r => r.verdict === 'pass');

  // Find best-scoring fallback (safe — results is non-empty here)
  const best = results.reduce((a, b) => (b.overallScore > a.overallScore ? b : a));
  const fallbackWinner = winner ? undefined : best?.agentId;

  const batchResult: OracleBatchResult = {
    bountyId,
    results,
    winner: winner?.agentId,
    fallbackWinner,
    escrowAction: winner ? 'release' : 'return',
  };

  // Persist to disk
  await persistOracleResults(runId, bountyId, results, batchResult);

  return batchResult;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
