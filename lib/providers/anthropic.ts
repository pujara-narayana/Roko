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

/** A base64-encoded image to attach to a vision request. */
export interface ImageInput {
  base64: string;
  mediaType: string; // 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
}

type MessageContent = string | Array<Record<string, unknown>>;

/**
 * Low-level Messages API call. Accepts either a plain prompt string or an array
 * of content blocks (for multimodal/vision). Returns the assistant's text, or
 * null on any failure. Never throws.
 */
async function callMessages(content: MessageContent, opts: CompleteOpts = {}): Promise<string | null> {
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
        messages: [{ role: 'user', content }],
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
    console.error('[anthropic] request failed:', err instanceof Error ? err.message : err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Single-turn text completion. Returns the assistant's text, or null on any
 * failure (not configured, network error, timeout, bad status). Never throws.
 */
export async function complete(prompt: string, opts: CompleteOpts = {}): Promise<string | null> {
  return callMessages(prompt, opts);
}

/**
 * Single-turn completion with one or more images attached (vision). The images
 * are sent before the prompt text. Returns the assistant's text, or null on any
 * failure. Never throws.
 */
export async function completeWithImages(
  prompt: string,
  images: ImageInput[],
  opts: CompleteOpts = {},
): Promise<string | null> {
  const content: Array<Record<string, unknown>> = [
    ...images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    })),
    { type: 'text', text: prompt },
  ];
  return callMessages(content, opts);
}

/**
 * Ask Claude to return strict JSON. Parses the first JSON object/array found.
 * Returns null on any failure so callers fall back to deterministic logic.
 */
export async function completeJSON<T = unknown>(prompt: string, opts: CompleteOpts = {}): Promise<T | null> {
  const text = await complete(prompt, withJsonSystem(opts));
  return parseJson<T>(text);
}

/**
 * Like completeJSON, but attaches images so Claude can SEE them while producing
 * the JSON (vision). Returns null on any failure so callers fall back.
 */
export async function completeJSONWithImages<T = unknown>(
  prompt: string,
  images: ImageInput[],
  opts: CompleteOpts = {},
): Promise<T | null> {
  const text = await completeWithImages(prompt, images, withJsonSystem(opts));
  return parseJson<T>(text);
}

function withJsonSystem(opts: CompleteOpts): CompleteOpts {
  return {
    ...opts,
    system: (opts.system ? opts.system + '\n\n' : '') +
      'Respond with ONLY valid JSON. No prose, no markdown fences.',
  };
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    const match = text.match(/[[{][\s\S]*[\]}]/);
    return JSON.parse(match ? match[0] : text) as T;
  } catch {
    return null;
  }
}
