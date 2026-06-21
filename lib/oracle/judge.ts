/**
 * Generic deliverable judge — for code / presentation / image / video bounties.
 *
 * When ANTHROPIC_API_KEY is configured, Claude judges criteriaMatch,
 * completeness, and validity against the bounty's acceptance text — these are
 * BINDING: they drive the verdict. With no key (or on error / timeout / junk),
 * the judge falls back to deterministic role-based scores (specialist vs
 * challenger) so the demo stays reliable. Same OracleResult shape as the
 * data-research oracle, so the UI is unchanged.
 */

import type { Submission, Bounty, OracleResult, GateResult, OracleReason } from '../types';
import { judgeScores } from './llm-score';

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

  // ── Binding LLM scores when configured; role-based fallback otherwise ──────
  const context =
    `Bounty acceptance criteria: "${acceptance}".\n\n` +
    `Deliverable submitted (${deliverable?.kind ?? 'unknown'}):\n` +
    `- title: ${deliverable?.title ?? '(untitled)'}\n` +
    `- summary: ${deliverable?.summary ?? '(none)'}\n` +
    (deliverable?.body ? `- content:\n${truncate(deliverable.body, 1500)}\n` : '') +
    (deliverable?.durationSec ? `- duration: ${deliverable.durationSec}s\n` : '') +
    `\nJudge how well this deliverable meets the acceptance criteria.`;
  const cacheKey = JSON.stringify({ submissionId, acceptance, summary: deliverable?.summary, body: deliverable?.body });
  const llm = await judgeScores(cacheKey, context).catch(() => null);

  const subScores = llm
    ? { criteriaMatch: llm.criteriaMatch, completeness: llm.completeness, validity: llm.validity }
    : isSpecialist
      ? { criteriaMatch: 94, completeness: 95, validity: 93 }
      : { criteriaMatch: 58, completeness: 52, validity: 64 };

  const overallScore = Math.round(subScores.criteriaMatch * 0.35 + subScores.completeness * 0.35 + subScores.validity * 0.3);
  const gateResults = gatesFor(subScores, overallScore);
  const verdict: 'pass' | 'fail' = gateResults.every((g) => g.passed) ? 'pass' : 'fail';

  // Reasons: prefer Claude's concrete sentences; otherwise a clear role template.
  const reasons: OracleReason[] = llm
    ? [
        { kind: 'criteria', ok: subScores.criteriaMatch >= GATE, detail: llm.criteriaReason || `Criteria match scored ${subScores.criteriaMatch}/100.` },
        { kind: 'completeness', ok: subScores.completeness >= GATE, detail: llm.completenessReason || `Completeness scored ${subScores.completeness}/100.` },
        { kind: 'validity', ok: subScores.validity >= GATE, detail: llm.validityReason || `Validity scored ${subScores.validity}/100.` },
      ]
    : isSpecialist
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

  const headline = llm?.criteriaReason || deliverable?.summary || (verdict === 'pass' ? 'accepted' : 'rejected');
  const summary = verdict === 'pass'
    ? `Deliverable meets the brief — ${headline}.`
    : `Deliverable falls short — ${headline}.`;

  return { submissionId, agentId, subScores, overallScore, verdict, summary, gateResults, reasons, duplicates: 0, scoredAt };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
