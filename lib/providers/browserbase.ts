/**
 * Browserbase provider — server-only.
 *
 * Gives the research agent a REAL cloud browser session for live web actions.
 * `retrieveCompanies` opens a Browserbase session, connects with Playwright over
 * CDP, and visits each target company's live website to verify it and capture a
 * real signal (final URL + page title). Every call is bounded by a timeout and a
 * concurrency cap, and the caller falls back to the seeded corpus on any failure
 * so the demo can never hang on a flaky site.
 *
 * Env: BROWSER_BASE_KEY (api key, present), BROWSERBASE_PROJECT_ID (required for
 * sessions).
 */

import { chromium } from 'playwright-core';
import Browserbase from '@browserbasehq/sdk';

const API_BASE = 'https://api.browserbase.com/v1';

export function isConfigured(): boolean {
  return !!process.env.BROWSER_BASE_KEY && process.env.BROWSER_BASE_KEY.length > 8;
}

export interface SessionHandle {
  sessionId: string;
  connectUrl?: string;
}

/**
 * Create a real Browserbase session. Returns null when not configured, when no
 * project id is available, or on any error — callers treat null as "use fallback".
 */
export async function createSession(timeoutMs = 12_000): Promise<SessionHandle | null> {
  if (!isConfigured()) return null;

  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  // The sessions endpoint requires a projectId. Without one we can't open a
  // real session — signal "fall back" rather than erroring.
  if (!projectId) {
    console.warn('[browserbase] BROWSERBASE_PROJECT_ID not set — skipping live session.');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}/sessions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-bb-api-key': process.env.BROWSER_BASE_KEY as string,
      },
      body: JSON.stringify({ projectId }),
    });
    if (!res.ok) {
      console.error(`[browserbase] session HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as { id?: string; connectUrl?: string };
    if (!json.id) return null;
    return { sessionId: json.id, connectUrl: json.connectUrl };
  } catch (err) {
    console.error('[browserbase] createSession failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Best-effort session close (fire-and-forget; never throws). */
export async function closeSession(sessionId: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-bb-api-key': process.env.BROWSER_BASE_KEY as string,
      },
      body: JSON.stringify({ status: 'REQUEST_RELEASE' }),
    });
  } catch {
    /* ignore */
  }
}

// ─── Live retrieval (CDP + Playwright) ────────────────────────────────────────

export interface CompanyTarget {
  name: string;
  website: string;   // bare domain, e.g. "stripe.com"
  revenue?: number;  // proposed estimate, used to fill the normalized record
}

export interface LiveCompanySignal {
  name: string;
  website: string;
  resolvedUrl: string; // final URL the live browser landed on ('' if unreachable)
  pageTitle: string;   // real <title> observed ('' if unreachable)
  reachable: boolean;
}

export interface RetrieveOpts {
  perPageTimeoutMs?: number; // per-site navigation cap
  concurrency?: number;      // parallel pages
  overallTimeoutMs?: number; // hard ceiling for the whole batch
}

/**
 * Drive a real Browserbase browser to each target company's website and capture
 * a live signal (final URL + page title). Returns the per-target signals, or
 * null if a session/connection could not be established. Never throws.
 */
export async function retrieveCompanies(
  targets: CompanyTarget[],
  opts: RetrieveOpts = {},
): Promise<LiveCompanySignal[] | null> {
  if (!isConfigured()) return null;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!projectId) {
    console.warn('[browserbase] BROWSERBASE_PROJECT_ID not set — cannot open a session.');
    return null;
  }

  const perPage = opts.perPageTimeoutMs ?? 7_000;
  const concurrency = Math.max(1, opts.concurrency ?? 3);
  const overall = opts.overallTimeoutMs ?? 40_000;

  const bb = new Browserbase({ apiKey: process.env.BROWSER_BASE_KEY as string });

  let session: { id: string; connectUrl: string };
  try {
    const s = await bb.sessions.create({ projectId });
    session = { id: s.id, connectUrl: s.connectUrl };
  } catch (err) {
    console.error('[browserbase] sessions.create failed:', err instanceof Error ? err.message : err);
    return null;
  }

  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | null = null;
  try {
    browser = await chromium.connectOverCDP(session.connectUrl);
    const context = browser.contexts()[0] ?? (await browser.newContext());

    const results: LiveCompanySignal[] = [];
    let next = 0;
    const worker = async () => {
      while (next < targets.length) {
        const t = targets[next++];
        const page = await context.newPage();
        try {
          const resp = await page.goto(`https://${t.website}`, {
            waitUntil: 'domcontentloaded',
            timeout: perPage,
          });
          const title = await page.title().catch(() => '');
          results.push({
            name: t.name,
            website: t.website,
            resolvedUrl: page.url(),
            pageTitle: title,
            reachable: !!resp && resp.ok(),
          });
        } catch {
          results.push({ name: t.name, website: t.website, resolvedUrl: '', pageTitle: '', reachable: false });
        } finally {
          await page.close().catch(() => {});
        }
      }
    };

    const pool = Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
    const timedOut = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), overall));
    const outcome = await Promise.race([pool.then(() => 'done' as const), timedOut]);
    if (outcome === 'timeout') {
      console.warn(`[browserbase] retrieveCompanies hit ${overall}ms ceiling — returning ${results.length} partial signals.`);
    }
    return results;
  } catch (err) {
    console.error('[browserbase] retrieveCompanies failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    try { await browser?.close(); } catch { /* ignore */ }
    void closeSession(session.id);
  }
}
