/**
 * Anthropic (Claude) provider — server-only.
 *
 * The shared "brain" every agent uses. Real HTTP calls to the Messages API
 * when ANTHROPIC_API_KEY is present; callers always wrap in try/catch and fall
 * back to seeded output so a flaky network can never hang the demo.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

// Fast + cheap by default for demo latency; override with ANTHROPIC_MODEL.
const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';

export function isConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.length > 10;
}

export interface CompleteOpts {
  system?: string;
  maxTokens?: number;
  model?: string;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Single-turn completion. Returns the assistant's text, or null on any failure
 * (not configured, network error, timeout, bad status). Never throws.
 */
export async function complete(prompt: string, opts: CompleteOpts = {}): Promise<string | null> {
  if (!isConfigured()) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY as string,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
        ...(opts.system ? { system: opts.system } : {}),
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error(`[anthropic] HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    }

    const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (json.content ?? [])
      .filter((b) => b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('\n')
      .trim();

    return text || null;
  } catch (err) {
    console.error('[anthropic] complete failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Ask Claude to return strict JSON. Parses the first JSON object/array found.
 * Returns null on any failure so callers fall back to deterministic logic.
 */
export async function completeJSON<T = unknown>(prompt: string, opts: CompleteOpts = {}): Promise<T | null> {
  const text = await complete(prompt, {
    ...opts,
    system: (opts.system ? opts.system + '\n\n' : '') +
      'Respond with ONLY valid JSON. No prose, no markdown fences.',
  });
  if (!text) return null;
  try {
    const match = text.match(/[[{][\s\S]*[\]}]/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}
