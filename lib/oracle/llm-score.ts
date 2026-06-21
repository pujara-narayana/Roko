/**
 * LLM sub-score judge — BINDING.
 *
 * When ANTHROPIC_API_KEY is configured, Claude scores a submission against the
 * bounty's acceptance criteria on three axes (criteriaMatch, completeness,
 * validity). Unlike the earlier non-gating semantic judge, these scores ARE
 * gating: the caller feeds them straight into the verdict. When no key is
 * present, or the call errors / times out / returns junk, `judgeScores` returns
 * null and the caller falls back to its own deterministic / role-based scoring.
 *
 * Demo-stability aids (the scores are binding, so run-to-run drift would flip
 * verdicts): temperature 0 + per-context in-memory caching, so an identical
 * submission scores identically on repeat runs within a process.
 */

import { createHash } from 'crypto';
import { anthropic } from '../providers';
import type { ImageInput } from '../providers/anthropic';

export interface LlmScore {
  criteriaMatch: number;       // 0–100
  completeness: number;        // 0–100
  validity: number;            // 0–100
  criteriaReason: string;
  completenessReason: string;
  validityReason: string;
}

const SYSTEM =
  'You are a strict, fair verification oracle for an AI-agent outcome marketplace. ' +
  'Score one submission against a bounty\'s acceptance criteria on three axes, each an integer 0–100:\n' +
  '- criteriaMatch: how well the records/output meet the stated hard criteria.\n' +
  '- completeness: how fully the required deliverable is provided (the full requested quantity, all required fields, no duplicates).\n' +
  '- validity: whether the data/output is WELL-FORMED, internally consistent, and not obviously fabricated. ' +
  'Treat correctly-formatted, plausible, non-duplicate records as valid and score them high (>= 90). ' +
  'Do NOT lower validity merely because you cannot independently verify the records exist in the real world — ' +
  'assume good faith unless there is a CONCRETE defect (malformed/placeholder values, impossible numbers, ' +
  'or emails the audit flagged as failing format/domain validation).\n' +
  'When an automated audit is provided in the message, treat its counts (criteria matches, duplicates, ' +
  'invalid emails) as ground truth and let them drive your scores. ' +
  'Reserve >= 90 for work that genuinely clears the bar; score real shortfalls honestly. ' +
  'Respond with ONLY this JSON object: ' +
  '{"criteriaMatch":<int>,"completeness":<int>,"validity":<int>,' +
  '"criteriaReason":"<one concrete sentence>","completenessReason":"<one concrete sentence>","validityReason":"<one concrete sentence>"}. ' +
  'Each reason must be one concrete sentence of at most 24 words.';

// Per-context cache so binding scores are stable across repeat runs in a process.
const _cache = new Map<string, LlmScore>();

function clampScore(n: unknown): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function oneSentence(s: unknown): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Judge a submission. `cacheKey` should uniquely identify the scored content
 * (records + requirements, or the deliverable + acceptance) so the cache is
 * sound. `context` is the user-message body describing what to score.
 * Returns null on any failure so the caller falls back to deterministic scoring.
 */
export async function judgeScores(cacheKey: string, context: string): Promise<LlmScore | null> {
  // Fast path: no key — skip the call entirely so the caller falls back.
  if (!anthropic.isConfigured()) return null;

  const hash = createHash('sha256').update(cacheKey).digest('hex');
  const hit = _cache.get(hash);
  if (hit) return hit;

  const raw = await anthropic
    .completeJSON<Partial<Record<keyof LlmScore, unknown>>>(context, {
      system: SYSTEM,
      maxTokens: 400,
      temperature: 0,      // binding scores → maximise run-to-run stability
      timeoutMs: 18_000,
    })
    .catch(() => null);

  if (!raw || typeof raw !== 'object') return null;
  // Require at least one numeric axis to be present — guards against parse junk.
  if (raw.criteriaMatch == null && raw.completeness == null && raw.validity == null) return null;

  const score: LlmScore = {
    criteriaMatch: clampScore(raw.criteriaMatch),
    completeness: clampScore(raw.completeness),
    validity: clampScore(raw.validity),
    criteriaReason: oneSentence(raw.criteriaReason),
    completenessReason: oneSentence(raw.completenessReason),
    validityReason: oneSentence(raw.validityReason),
  };
  _cache.set(hash, score);
  return score;
}

// ─── Vision judge (image deliverables) ────────────────────────────────────────

const VISION_SYSTEM =
  'You are a strict, fair verification oracle for an AI-agent outcome marketplace. ' +
  'You are shown an IMAGE that a competing agent generated to fulfill a bounty, plus the ' +
  'bounty acceptance criteria. Judge the IMAGE ITSELF (what you actually see), not any text ' +
  'description of it. Score on three integer axes 0–100:\n' +
  '- criteriaMatch: does the image depict what the brief asked for — subject, style, ' +
  'composition, and any stated constraints?\n' +
  '- completeness: are all requested elements actually present in the image?\n' +
  '- validity: is it a coherent, well-formed image, free of obvious generation defects ' +
  '(garbled text, malformed anatomy, artifacts, a blank/broken render)?\n' +
  'Reserve >= 90 for images that genuinely satisfy the brief; score real shortfalls honestly. ' +
  'Respond with ONLY this JSON object: ' +
  '{"criteriaMatch":<int>,"completeness":<int>,"validity":<int>,' +
  '"criteriaReason":"<one concrete sentence>","completenessReason":"<one concrete sentence>","validityReason":"<one concrete sentence>"}. ' +
  'Each reason must be one concrete sentence of at most 24 words, describing what you SEE.';

/**
 * Judge an image deliverable by actually showing the rendered image to Claude.
 * Same binding contract and cache discipline as judgeScores. Returns null on any
 * failure (no key / timeout / error / junk) so the caller falls back.
 */
export async function judgeImageScores(
  cacheKey: string,
  context: string,
  image: ImageInput,
): Promise<LlmScore | null> {
  if (!anthropic.isConfigured()) return null;

  const hash = createHash('sha256').update('vision:' + cacheKey).digest('hex');
  const hit = _cache.get(hash);
  if (hit) return hit;

  const raw = await anthropic
    .completeJSONWithImages<Partial<Record<keyof LlmScore, unknown>>>(context, [image], {
      system: VISION_SYSTEM,
      maxTokens: 400,
      temperature: 0,
      timeoutMs: 22_000,
    })
    .catch(() => null);

  if (!raw || typeof raw !== 'object') return null;
  if (raw.criteriaMatch == null && raw.completeness == null && raw.validity == null) return null;

  const score: LlmScore = {
    criteriaMatch: clampScore(raw.criteriaMatch),
    completeness: clampScore(raw.completeness),
    validity: clampScore(raw.validity),
    criteriaReason: oneSentence(raw.criteriaReason),
    completenessReason: oneSentence(raw.completenessReason),
    validityReason: oneSentence(raw.validityReason),
  };
  _cache.set(hash, score);
  return score;
}
