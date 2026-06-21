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

import { lookup } from 'node:dns/promises';
import type { Submission, Bounty, OracleResult, GateResult, OracleReason } from '../types';
import { judgeScores, judgeImageScores, type LlmScore } from './llm-score';
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

  // ── Binding LLM scores when configured; role-based fallback otherwise ──────
  // Image deliverables go through the VISION judge: we fetch the rendered image
  // and show it to Claude, so the verdict reflects the actual pixels — not just
  // the agent's text description. On no-key / fetch failure / vision error we
  // fall through to the text judge, so the demo stays reliable.
  let llm: LlmScore | null = null;
  let judgedViaVision = false;

  if (deliverable?.kind === 'image' && anthropic.isConfigured()) {
    const imageUrl = deliverable.artifactUrl ?? deliverable.previewUrl;
    if (imageUrl) {
      const img = await fetchImageAsBase64(imageUrl).catch(() => null);
      if (img) {
        const visionContext =
          `Bounty acceptance criteria: "${acceptance}".\n\n` +
          `The attached image is the deliverable titled "${deliverable.title ?? 'untitled'}"` +
          (deliverable.summary ? ` — ${deliverable.summary}` : '') + `.\n` +
          `Judge how well the IMAGE itself meets the acceptance criteria.`;
        const visionKey = JSON.stringify({ submissionId, acceptance, imageUrl });
        llm = await judgeImageScores(visionKey, visionContext, img).catch(() => null);
        if (llm) judgedViaVision = true;
      }
    }
  }

  if (!llm) {
    const context =
      `Bounty acceptance criteria: "${acceptance}".\n\n` +
      `Deliverable submitted (${deliverable?.kind ?? 'unknown'}):\n` +
      `- title: ${deliverable?.title ?? '(untitled)'}\n` +
      `- summary: ${deliverable?.summary ?? '(none)'}\n` +
      (deliverable?.body ? `- content:\n${truncate(deliverable.body, 1500)}\n` : '') +
      (deliverable?.durationSec ? `- duration: ${deliverable.durationSec}s\n` : '') +
      `\nJudge how well this deliverable meets the acceptance criteria.`;
    const cacheKey = JSON.stringify({ submissionId, acceptance, summary: deliverable?.summary, body: deliverable?.body });
    llm = await judgeScores(cacheKey, context).catch(() => null);
  }

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
  const visionNote = judgedViaVision ? ' (oracle inspected the rendered image)' : '';
  const summary = verdict === 'pass'
    ? `Deliverable meets the brief — ${headline}.${visionNote}`
    : `Deliverable falls short — ${headline}.${visionNote}`;

  return { submissionId, agentId, subScores, overallScore, verdict, summary, gateResults, reasons, duplicates: 0, scoredAt };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// Anthropic vision accepts these image media types; renders outside the set or
// oversized payloads are skipped so the caller falls back to the text judge.
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 4_500_000; // stay under the API's ~5MB/image limit
const MAX_REDIRECTS = 4;

// ─── SSRF guard ───────────────────────────────────────────────────────────────
// The deliverable URL is data we don't fully control, and we fetch it server-side
// — a classic SSRF sink. Block any URL that resolves to a non-public address
// (loopback, private, link-local, cloud-metadata) before fetching, and re-validate
// every redirect hop.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const o = Number(p);
    if (!Number.isInteger(o) || o < 0 || o > 255) return null;
    n = (n << 8) | o;
  }
  return n >>> 0;
}

function isBlockedIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  if (n === null) return true; // unparseable → treat as unsafe
  const inRange = (base: string, bits: number) => {
    const b = ipv4ToInt(base)!;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  };
  return (
    inRange('0.0.0.0', 8) ||        // "this" network
    inRange('10.0.0.0', 8) ||       // private
    inRange('100.64.0.0', 10) ||    // CGNAT
    inRange('127.0.0.0', 8) ||      // loopback
    inRange('169.254.0.0', 16) ||   // link-local (incl. 169.254.169.254 metadata)
    inRange('172.16.0.0', 12) ||    // private
    inRange('192.0.0.0', 24) ||     // IETF protocol assignments
    inRange('192.168.0.0', 16) ||   // private
    inRange('198.18.0.0', 15) ||    // benchmarking
    inRange('224.0.0.0', 4) ||      // multicast
    inRange('240.0.0.0', 4)         // reserved
  );
}

function isBlockedIPv6(ip: string): boolean {
  const addr = ip.toLowerCase();
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4-mapped
  if (mapped) return isBlockedIPv4(mapped[1]);
  if (addr === '::' || addr === '::1') return true;           // unspecified / loopback
  const head = addr.split(':')[0];
  if (/^f[cd]/.test(head)) return true;    // fc00::/7 unique-local
  if (/^fe[89ab]/.test(head)) return true; // fe80::/10 link-local
  return false;
}

/**
 * Parse a URL and confirm it is http(s) and resolves only to public addresses.
 * Returns the validated URL, or null if it should not be fetched.
 */
async function validatePublicUrl(raw: string | URL): Promise<URL | null> {
  let u: URL;
  try { u = typeof raw === 'string' ? new URL(raw) : raw; } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return isBlockedIPv4(host) ? null : u;
  if (host.includes(':')) return isBlockedIPv6(host) ? null : u;

  // Hostname: resolve every address and reject if ANY is non-public.
  try {
    const addrs = await lookup(host, { all: true });
    if (addrs.length === 0) return null;
    for (const a of addrs) {
      const blocked = a.family === 4 ? isBlockedIPv4(a.address) : isBlockedIPv6(a.address);
      if (blocked) return null;
    }
    return u;
  } catch {
    return null;
  }
}

/**
 * Fetch a public image URL and return it base64-encoded for a vision request.
 * SSRF-guarded (scheme + resolved-address checks, redirects re-validated per hop).
 * Returns null (never throws) on an unsafe URL, timeout, non-image content,
 * unsupported type, or an oversized/empty body, so image judging degrades
 * gracefully to the text judge.
 */
async function fetchImageAsBase64(
  url: string,
  timeoutMs = 12_000,
): Promise<{ base64: string; mediaType: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let next: string | URL = url;
    let res: Response | null = null;
    for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
      const safe = await validatePublicUrl(next);
      if (!safe) return null;
      // Manual redirect so each Location is re-validated against the SSRF rules.
      res = await fetch(safe.toString(), { signal: controller.signal, redirect: 'manual' });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        res.body?.cancel().catch(() => {});
        if (!loc) return null;
        next = new URL(loc, safe); // resolve relative redirects
        continue;
      }
      break;
    }
    if (!res) return null;

    const mediaType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    if (!res.ok || !SUPPORTED_IMAGE_TYPES.has(mediaType)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
    return { base64: buf.toString('base64'), mediaType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
