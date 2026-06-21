/**
 * Intake agent — compiles plain-text bounty description into
 * a structured AcceptanceRequirements JSON.
 *
 * For the demo path: pattern-match against known keywords deterministically.
 * If ANTHROPIC_API_KEY is present, could call Claude — but that path is not
 * required for the demo and would add latency + API key dependency.
 */

import type { AcceptanceRequirements } from './types';
import { HERO_REQUIREMENTS } from './seed/fixtures';

// ─── Keyword patterns ─────────────────────────────────────────────────────────

const FINTECH_KEYWORDS = ['fintech', 'financial technology', 'fin-tech', 'payments', 'banking'];
const US_KEYWORDS = ['us', 'u.s.', 'united states', 'american', 'usa'];
const EMAIL_KEYWORDS = ['email', 'emails', 'contact', 'vp of engineering', 'vp-of-engineering'];

// ─── Revenue extractor (e.g. "$1M+", "1 million", "≥$1M") ───────────────────

function extractRevenue(text: string): number {
  // Match patterns like "$1M+", "1M", "1 million", "$1,000,000"
  const patterns = [
    /\$?(\d+(?:\.\d+)?)\s*m(?:illion)?/i,
    /\$?(\d{1,3}(?:,\d{3})*)/,
    /≥\s*\$?(\d+(?:\.\d+)?)\s*m/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (m) {
      const raw = parseFloat(m[1].replace(/,/g, ''));
      // If the number looks like millions (< 10000), multiply
      return raw < 10_000 ? raw * 1_000_000 : raw;
    }
  }
  return 0;
}

// ─── Count extractor ──────────────────────────────────────────────────────────

function extractCount(text: string): number {
  const m = text.match(/\b(\d+)\b/);
  if (m) return parseInt(m[1], 10);
  return 0;
}

// ─── Compile requirements from description ────────────────────────────────────

export function compileRequirements(description: string): AcceptanceRequirements {
  const lower = description.toLowerCase();

  // If it matches the hero bounty description, return the canned requirements
  if (
    lower.includes('fintech') &&
    (lower.includes('vp') || lower.includes('engineer')) &&
    lower.includes('email')
  ) {
    return HERO_REQUIREMENTS;
  }

  // Generic fallback: best-effort parsing
  const sector = FINTECH_KEYWORDS.some(k => lower.includes(k)) ? 'fintech' : 'general';
  const geo = US_KEYWORDS.some(k => lower.includes(k)) ? 'US' : 'global';
  const minRevenue = extractRevenue(description);
  const targetCount = extractCount(description) || 20;
  const needsEmail = EMAIL_KEYWORDS.some(k => lower.includes(k));

  const requiredFields = ['name', 'sector', 'geo', 'revenue'];
  if (needsEmail) requiredFields.push('vpEngEmail');

  const criteria = [];

  if (sector !== 'general') {
    criteria.push({
      id: 'c-sector',
      label: `${sector} sector company`,
      predicate: `sector === "${sector}" && geo === "${geo}"`,
      semantic: `Company must be a ${geo}-based ${sector} firm`,
      weight: 0.3,
    });
  }

  if (minRevenue > 0) {
    criteria.push({
      id: 'c-revenue',
      label: `Revenue ≥ $${(minRevenue / 1_000_000).toFixed(0)}M ARR`,
      predicate: `revenue >= ${minRevenue}`,
      semantic: `Company must have at least $${(minRevenue / 1_000_000).toFixed(0)}M annual revenue`,
      weight: 0.35,
    });
  }

  if (needsEmail) {
    criteria.push({
      id: 'c-email',
      label: 'Valid contact email',
      predicate: 'email matches RFC-5322',
      semantic: 'Email address must be RFC-compliant with valid domain',
      weight: criteria.length === 0 ? 1 : 0.35,
    });
  }

  return {
    targetCount,
    sector,
    geo,
    minRevenue,
    requiredFields,
    criteria,
  };
}
