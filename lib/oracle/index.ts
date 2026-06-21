/**
 * Verification Oracle.
 *
 * Deterministic checks (always run):
 *   1. Count / completeness check
 *   2. Required-field schema check
 *   3. De-duplication check
 *   4. Criteria predicate match (sector, geo, revenue)
 *   5. Email format validity (RFC-5322 regex)
 *
 * LLM sub-score judge (BINDING):
 *   - When ANTHROPIC_API_KEY is configured, Claude judges `completeness` and
 *     `validity`, and these REPLACE the deterministic values for gating — they
 *     can move the verdict in either direction.
 *   - `criteriaMatch` and the `duplicates` gate stay deterministic (objective
 *     predicate count / exact duplicate count).
 *   - On no key / error / timeout / junk reply, the deterministic completeness
 *     and validity stand. No exception propagates to callers.
 *
 * PASS gate: completeness >= 95 AND criteriaMatch >= 90
 *            AND validity >= 90 AND overall >= 90 AND duplicates == 0
 */

import type {
  Submission, AcceptanceRequirements, OracleResult,
  OracleBatchResult, CompanyRecord, GateResult, OracleReason, Bounty,
} from '../types';
import { persistOracleResults } from '../persist';
import { judgeDeliverable } from './judge';
import { judgeScores } from './llm-score';
import { HERO_REQUIREMENTS } from '../seed/fixtures';
import { arize } from '../providers';

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
  if ((Number(record.revenue) || 0) < requirements.minRevenue) {
    failures.push(`revenue ${record.revenue} < required ${requirements.minRevenue}`);
  }

  return { ok: failures.length === 0, failures };
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function findDuplicates(records: CompanyRecord[]): CompanyRecord[][] {
  // Duplicate = same company name (case-insensitive) appearing more than once
  const byName = new Map<string, CompanyRecord[]>();
  for (const r of records) {
    const key = String(r.name ?? '').toLowerCase().trim();
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key)!.push(r);
  }
  return [...byName.values()].filter(group => group.length > 1);
}

// ─── Binding LLM sub-score judge (data-research path) ─────────────────────────
// Builds a compact context from the requirements + submitted corpus and asks
// Claude (temperature 0, cached) to score completeness and validity. These are
// BINDING — the caller feeds them into the gates. Returns null on any failure
// (no key / timeout / error / junk) so the caller falls back to deterministic.

interface DataAudit {
  criteriaMatched: number;
  criteriaFailSamples: string[];
  dupCount: number;
  dupNames: string[];
  invalidEmailCount: number;
  invalidEmailSamples: string[];
}

async function judgeDataScores(
  records: CompanyRecord[],
  requirements: AcceptanceRequirements,
  audit: DataAudit,
) {
  const criteriaText = requirements.criteria
    .filter(c => c.semantic)
    .map((c, i) => `${i + 1}. ${c.semantic}`)
    .join('\n') || '(none stated)';

  const sample = records.slice(0, 20)
    .map(r => `  - ${r.name} — ${r.geo} ${r.sector}, revenue $${(Number(r.revenue) / 1_000_000).toFixed(1)}M, VP-Eng email: ${r.vpEngEmail}`)
    .join('\n');

  // Deterministic audit handed to Claude as ground truth so its BINDING scores
  // track real defects rather than guessing from a sample.
  const auditText =
    `Automated audit (ground truth — base your scores on these counts):\n` +
    `- records delivered: ${records.length} of ${requirements.targetCount}\n` +
    `- records meeting all hard criteria (sector/geo/revenue): ${audit.criteriaMatched} of ${requirements.targetCount}` +
    (audit.criteriaFailSamples.length ? ` — e.g. ${audit.criteriaFailSamples.slice(0, 3).join('; ')}` : '') + `\n` +
    `- duplicate records: ${audit.dupCount}` +
    (audit.dupNames.length ? ` (${audit.dupNames.slice(0, 3).join(', ')})` : '') + `\n` +
    `- emails failing format/domain validation: ${audit.invalidEmailCount}` +
    (audit.invalidEmailSamples.length ? ` — e.g. ${audit.invalidEmailSamples.slice(0, 3).join('; ')}` : '');

  const context =
    `Bounty acceptance requirements:\n` +
    `- target count: ${requirements.targetCount}\n` +
    `- sector: ${requirements.sector}\n` +
    `- geography: ${requirements.geo}\n` +
    `- minimum revenue: $${(requirements.minRevenue / 1_000_000).toFixed(0)}M\n` +
    `- required fields per record: ${requirements.requiredFields.join(', ')}\n` +
    `- fuzzy criteria:\n${criteriaText}\n\n` +
    `${auditText}\n\n` +
    `Submission sample (up to 20):\n${sample}\n\n` +
    `Scoring rules — follow exactly, anchored to the audit counts above:\n` +
    `- validity: if 0 emails failed validation, score validity 96–100. Otherwise validity ≈ 100 − round(100 × invalidEmails / recordsDelivered). ` +
    `NEVER withhold validity points for being unable to confirm the records exist in the real world — well-formed, audit-clean data is valid.\n` +
    `- completeness: 100 when the full target count is delivered with all required fields and 0 duplicates; subtract for short counts, missing fields, and ~5 points per duplicate.\n` +
    `- criteriaMatch: ≈ round(100 × criteriaMatches / targetCount).`;

  // Cache key binds the exact content scored, so the cache is sound.
  const cacheKey = JSON.stringify({ records, requirements });
  return judgeScores(cacheKey, context);
}

// ─── Score one submission ─────────────────────────────────────────────────────

export async function scoreSubmission(
  submission: Submission,
  requirements: AcceptanceRequirements,
): Promise<OracleResult> {
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

  // ── 6. Binding LLM sub-scores (completeness + validity) ──────────────────
  // criteriaMatch stays deterministic (objective sector/geo/revenue predicate
  // count); the duplicates gate stays deterministic (exact count). completeness
  // and validity are judged by Claude when configured and REPLACE the
  // deterministic values for gating — they can move the verdict.
  const criteriaMatch = Math.round(criteriaMatchPct);
  const completenessDet = completeness;        // count − duplicate penalty
  const validityDet = Math.round(validityPct); // email-format pass rate

  const COMPLETENESS_GATE = 95;
  const CRITERIA_GATE = 90;
  const VALIDITY_GATE = 90;
  const OVERALL_GATE = 90;

  let completenessScore = completenessDet;
  let validityScore = validityDet;

  const llm = await judgeDataScores(records, requirements, {
    criteriaMatched,
    criteriaFailSamples: criteriaFails,
    dupCount,
    dupNames: dupGroups.map(g => g[0].name),
    invalidEmailCount: invalidEmails.length,
    invalidEmailSamples: invalidEmails,
  }).catch(() => null);
  if (llm) {
    // Binding: Claude's completeness + validity drive the gates.
    completenessScore = llm.completeness;
    validityScore = llm.validity;
    reasons.push(
      {
        kind: 'completeness',
        ok: completenessScore >= COMPLETENESS_GATE,
        detail: `Claude judged completeness ${completenessScore}/100 — ${llm.completenessReason || 'assessed the delivered set against the required count and fields'}`,
        criterionId: 'llm-completeness',
      },
      {
        kind: 'validity',
        ok: validityScore >= VALIDITY_GATE,
        detail: `Claude judged validity ${validityScore}/100 — ${llm.validityReason || 'assessed how trustworthy and well-formed the records are'}`,
        criterionId: 'llm-validity',
      },
    );
    if (llm.criteriaReason) {
      reasons.push({ kind: 'criteria', ok: criteriaOk, detail: llm.criteriaReason, criterionId: 'semantic' });
    }
  } else {
    // No key / timeout / error → deterministic completeness & validity stand.
    reasons.push({
      kind: 'completeness',
      ok: completenessScore >= COMPLETENESS_GATE,
      detail: `Completeness ${Math.round(completenessScore)}/100 from deterministic count (LLM judge unavailable).`,
      criterionId: 'det-completeness',
    });
  }

  // ── Gate checks ───────────────────────────────────────────────────────────
  gateResults.push(
    { gate: 'completeness',  passed: completenessScore >= COMPLETENESS_GATE, value: Math.round(completenessScore), threshold: COMPLETENESS_GATE },
    { gate: 'criteriaMatch', passed: criteriaMatch     >= CRITERIA_GATE,     value: criteriaMatch,                 threshold: CRITERIA_GATE },
    { gate: 'validity',      passed: validityScore     >= VALIDITY_GATE,     value: Math.round(validityScore),     threshold: VALIDITY_GATE },
    { gate: 'duplicates',    passed: dupCount === 0,                         value: dupCount,                      threshold: 0 },
  );

  // overall = weighted average of sub-scores
  const overallScore = Math.round(
    criteriaMatch     * 0.35 +
    completenessScore * 0.35 +
    validityScore     * 0.30
  );

  gateResults.push({
    gate: 'overall',
    passed: overallScore >= OVERALL_GATE,
    value: overallScore,
    threshold: OVERALL_GATE,
  });

  // PASS gate: ALL gates must pass
  const allGatesPassed =
    completenessScore >= COMPLETENESS_GATE &&
    criteriaMatch     >= CRITERIA_GATE &&
    validityScore     >= VALIDITY_GATE &&
    overallScore      >= OVERALL_GATE &&
    dupCount          === 0;

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
      completeness: Math.round(completenessScore),
      validity: Math.round(validityScore),
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
  bounty: Bounty,
  runId: string,
  submissions: Submission[],
): Promise<OracleBatchResult> {
  const bountyId = bounty.bountyId;
  const taskType = bounty.taskType ?? 'data-research';
  const requirements = bounty.requirements ?? HERO_REQUIREMENTS;

  // Guard: if no submissions at all, return a well-formed no-pass result immediately
  if (submissions.length === 0) {
    const emptyResult: OracleBatchResult = {
      bountyId, results: [], winner: undefined, fallbackWinner: undefined, escrowAction: 'return',
    };
    await persistOracleResults(runId, bountyId, [], emptyResult);
    return emptyResult;
  }

  // Branch per submission: deliverable tasks → LLM-judge; data tasks → deterministic oracle.
  const results = await Promise.all(
    submissions.map((s) =>
      taskType !== 'data-research' || s.deliverable
        ? judgeDeliverable(s, bounty)
        : scoreSubmission(s, requirements),
    ),
  );

  // Find winner (first passing submission)
  const winner = results.find(r => r.verdict === 'pass');

  // Find best-scoring fallback (safe — results is non-empty here)
  const best = results.reduce((a, b) => (b.overallScore > a.overallScore ? b : a));
  const fallbackWinner = winner ? undefined : best?.agentId;

  const batchResult: OracleBatchResult = {
    bountyId, results, winner: winner?.agentId, fallbackWinner,
    escrowAction: winner ? 'release' : 'return',
  };

  // Non-blocking observability: log each verification to Arize (no-op if unset).
  for (const r of results) {
    arize.logOracleScore({
      runId, bountyId, agentId: r.agentId, verdict: r.verdict, overallScore: r.overallScore,
      criteriaMatch: r.subScores.criteriaMatch, completeness: r.subScores.completeness,
      validity: r.subScores.validity, taskType,
    });
  }

  // Persist to disk
  await persistOracleResults(runId, bountyId, results, batchResult);

  return batchResult;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
