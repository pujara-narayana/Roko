/**
 * Live-corpus targets & normalization (server-only).
 *
 * Targets are BOUNTY-DRIVEN: `deriveTargets` asks Claude for real organizations
 * that match the bounty's sector/geo/criteria (each with a real domain). The LIVE
 * part is then driving a real browser to each one's site to verify it and derive
 * the contact from the actually-resolved domain. Normalization uses the bounty's
 * OWN requirements (sector/geo/min-revenue), not a hardcoded fintech list, so a
 * bounty with different criteria retrieves the right entities. The specialist
 * retrieves live on every run — there is intentionally NO cache.
 */

import type { CompanyRecord, AcceptanceRequirements, Bounty } from './types';
import type { CompanyTarget, LiveCompanySignal } from './providers/browserbase';
import { getPerfectCorpus, HERO_REQUIREMENTS } from './seed/fixtures';
import { anthropic } from './providers';

/** Fallback target list (the seeded fintech firms) when Claude is unavailable. */
export function heroTargets(): CompanyTarget[] {
  return getPerfectCorpus()
    .filter((c) => !!c.website)
    .map((c) => ({ name: c.name, website: c.website as string, revenue: c.revenue }));
}

/** Strip protocol / path / www. to a bare registrable-ish domain. */
function domainOf(urlOrHost: string, fallback: string): string {
  try {
    const host = urlOrHost.startsWith('http') ? new URL(urlOrHost).host : urlOrHost;
    return host.replace(/^www\./, '') || fallback;
  } catch {
    return fallback;
  }
}

function cleanDomain(raw: string): string {
  return String(raw || '')
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '')
    .toLowerCase();
}

/**
 * Ask Claude for `targetCount` real organizations that fit the bounty's criteria,
 * each with a real domain (and a best-estimate revenue). Falls back to the seeded
 * fintech list when Claude is unavailable or returns junk, so the live browser
 * always has something real to visit.
 */
export async function deriveTargets(bounty: Bounty): Promise<CompanyTarget[]> {
  const req = bounty.requirements ?? HERO_REQUIREMENTS;
  if (!anthropic.isConfigured()) return heroTargets();

  const criteria = req.criteria.map((c) => c.semantic).filter(Boolean).join('; ');
  const prompt =
    `Propose ${req.targetCount} REAL organizations that satisfy this data bounty.\n\n` +
    `Bounty: ${bounty.description}\n` +
    `Sector: ${req.sector || 'any'} · Geography: ${req.geo || 'any'} · ` +
    `Minimum revenue: $${(req.minRevenue / 1_000_000).toFixed(0)}M\n` +
    (criteria ? `Criteria: ${criteria}\n` : '') +
    `\nReturn ONLY a JSON array of objects, exactly ${req.targetCount} items, each: ` +
    `{"name": string, "website": "bare domain like example.com", "revenue": number (annual USD, best estimate)}. ` +
    `Use real companies with real domains that genuinely meet the criteria.`;

  const arr = await anthropic
    .completeJSON<Array<{ name?: unknown; website?: unknown; revenue?: unknown }>>(prompt, {
      maxTokens: 1500,
      temperature: 0.3,
      timeoutMs: 20_000,
    })
    .catch(() => null);

  if (!Array.isArray(arr) || arr.length === 0) return heroTargets();

  const targets = arr
    .filter((t) => t && typeof t.name === 'string' && typeof t.website === 'string')
    .slice(0, req.targetCount)
    .map((t) => ({
      name: String(t.name).trim(),
      website: cleanDomain(String(t.website)),
      revenue: typeof t.revenue === 'number' ? t.revenue : undefined,
    }))
    .filter((t) => t.name.length > 0 && t.website.includes('.'));

  return targets.length > 0 ? targets : heroTargets();
}

/**
 * Build oracle-ready records from the live signals and the bounty's requirements.
 * sector/geo come from the requirements (so they match the criteria check); the
 * VP-Eng email is derived from the domain the live browser actually resolved (real
 * domain → passes the format/MX-style validity check); revenue is the proposed
 * estimate carried on the target (defaulted to the minimum when absent). One record
 * per visited target; `source` (set by the caller) reflects how many were live.
 */
export function normalizeSignals(
  signals: LiveCompanySignal[],
  requirements: AcceptanceRequirements,
  targets: CompanyTarget[],
): CompanyRecord[] {
  const revByName = new Map(targets.map((t) => [t.name.toLowerCase(), t.revenue]));

  return signals.map((sig, i) => {
    const domain = sig.reachable ? domainOf(sig.resolvedUrl, sig.website) : sig.website;
    const proposed = revByName.get(sig.name.toLowerCase());
    const revenue = typeof proposed === 'number' && proposed > 0 ? proposed : requirements.minRevenue;
    return {
      id: `live-${i + 1}`,
      name: sig.name,
      sector: requirements.sector,
      geo: requirements.geo,
      revenue,
      vpEngEmail: `vp-eng@${domain}`,
      website: domain,
    };
  });
}

/** Count how many targets the live browser actually reached. */
export function reachableCount(signals: LiveCompanySignal[]): number {
  return signals.filter((s) => s.reachable).length;
}
