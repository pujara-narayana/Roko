/**
 * Browserbase provider — server-only.
 *
 * Gives the research agent a real cloud browser session for live web actions.
 * We create a genuine Browserbase session (proves the integration is live);
 * heavy headless scraping via CDP/Playwright is intentionally deferred, so the
 * caller pairs a successful session with Claude-driven synthesis and falls back
 * to the seeded corpus on any failure — the demo can never hang on a flaky site.
 *
 * Env: BROWSER_BASE_KEY (present), BROWSERBASE_PROJECT_ID (optional).
 */

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
