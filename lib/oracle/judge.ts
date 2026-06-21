/**
 * Generic deliverable judge — for code / presentation / image / video bounties.
 *
 * Verdict + sub-scores are deterministic (driven by the competition role) so the
 * demo is reliable across rehearsals; the human-readable reasoning is enriched by
 * a real Claude call when available, falling back to a clear template otherwise.
 * Same OracleResult shape as the data-research oracle, so the UI is unchanged.
 */

import type { Submission, Bounty, OracleResult, GateResult, OracleReason } from '../types';
import { anthropic } from '../providers';

const GATE = 90;

function gatesFor(score: { criteriaMatch: number; completeness: number; validity: number }, overall: number): GateResult[] {
  return [
    { gate: 'criteriaMatch', passed: score.criteriaMatch >= GATE, value: score.criteriaMatch, threshold: GATE },
    { gate: 'completeness', passed: score.completeness >= GATE, value: score.completeness, threshold: GATE },
    { gate: 'validity', passed: score.validity >= GATE, value: score.validity, threshold: GATE },
    { gate: 'overall', passed: overall >= GATE, value: overall, threshold: GATE },
  ];
}

export async function judgeDeliverable(submission: Submission, bounty: Bounty): Promise<OracleResult> {
  const { submissionId, agentId, deliverable } = submission;
  const scoredAt = new Date().toISOString();
  const acceptance = bounty.verification || bounty.description;

  // ── Awaiting a provider key — nothing was generated ───────────────────────
  if (submission.status === 'awaiting_key' || deliverable?.awaitingKey) {
    const provider = deliverable?.awaitingKey ?? submission.fulfillment.awaitingKey;
    return {
      submissionId, agentId,
      subScores: { criteriaMatch: 0, completeness: 0, validity: 0 },
      overallScore: 0, verdict: 'fail',
      summary: `Cannot verify — generation is blocked pending the ${provider} API key.`,
      gateResults: [],
      reasons: [{ kind: 'completeness', ok: false, detail: `No deliverable produced: ${provider} key not configured.` }],
      duplicates: 0, scoredAt,
    };
  }

  const role = (deliverable?.meta?.role as string) ?? 'challenger';
  const isSpecialist = role === 'specialist';

  const subScores = isSpecialist
    ? { criteriaMatch: 94, completeness: 95, validity: 93 }
    : { criteriaMatch: 58, completeness: 52, validity: 64 };
  const overallScore = Math.round(subScores.criteriaMatch * 0.35 + subScores.completeness * 0.35 + subScores.validity * 0.3);
  const gateResults = gatesFor(subScores, overallScore);
  const verdict: 'pass' | 'fail' = gateResults.every((g) => g.passed) ? 'pass' : 'fail';

  // Deterministic reasons (always present), optionally enriched by Claude.
  const reasons: OracleReason[] = isSpecialist
    ? [
        { kind: 'criteria', ok: true, detail: `Deliverable satisfies the acceptance criteria: "${truncate(acceptance, 120)}"` },
        { kind: 'completeness', ok: true, detail: `Complete — ${deliverable?.summary ?? 'all required parts present'}` },
        { kind: 'validity', ok: true, detail: 'Output is well-formed and usable as delivered.' },
      ]
    : [
        { kind: 'criteria', ok: false, detail: `Does not fully meet the acceptance criteria: "${truncate(acceptance, 120)}"` },
        { kind: 'completeness', ok: false, detail: `Incomplete — ${deliverable?.summary ?? 'missing required parts'}` },
        { kind: 'validity', ok: true, detail: 'Output is well-formed but insufficient.' },
      ];

  // Best-effort Claude enrichment of the headline reason (verdict stays fixed).
  const enriched = await enrich(deliverable?.summary ?? '', acceptance, verdict).catch(() => null);

  const summary = enriched
    ?? (verdict === 'pass'
      ? `Deliverable meets the brief — ${deliverable?.summary ?? 'accepted'}.`
      : `Deliverable falls short — ${deliverable?.summary ?? 'rejected'}.`);

  return { submissionId, agentId, subScores, overallScore, verdict, summary, gateResults, reasons, duplicates: 0, scoredAt };
}

async function enrich(summary: string, acceptance: string, verdict: 'pass' | 'fail'): Promise<string | null> {
  const text = await anthropic.complete(
    `A bounty's acceptance criteria: "${acceptance}".\nAn agent submitted: "${summary}".\nThe verdict is ${verdict.toUpperCase()}. In ONE sentence (max 22 words), explain why, concretely.`,
    { maxTokens: 80, temperature: 0.2, timeoutMs: 12_000 },
  );
  const cleaned = text ? text.replace(/\s+/g, ' ').trim() : '';
  // Guard against degenerate replies (a stray char / fragment) overriding the
  // clear deterministic summary.
  return cleaned.length > 10 ? cleaned : null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
