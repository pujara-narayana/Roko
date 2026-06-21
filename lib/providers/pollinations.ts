/**
 * Pollinations provider — server-only. Free, keyless text-to-image.
 *
 * Unlike Pika/Midjourney/Gemini, Pollinations needs no API key and has no
 * billing gate, so isConfigured() is always true and the image path never hits
 * the "awaiting key" popup. Generation happens by GET on a deterministic URL —
 * we build a stable, seed-pinned URL, do a lightweight server-side validation
 * fetch so the agent's "render" step is real (and fails gracefully if the
 * service is down), then hand the URL to the client, which the <img> tag
 * re-fetches from Pollinations' cache.
 */

const BASE_URL = 'https://image.pollinations.ai/prompt';

// Pollinations is keyless and free — always available. Kept as a function so it
// fits the provider registry's isConfigured() contract.
export function isConfigured(): boolean {
  return true;
}

export interface ImageResult {
  awaitingKey?: boolean;
  artifactUrl?: string;
  previewUrl?: string;
}

export interface ImageOpts {
  width?: number;
  height?: number;
  model?: string;
  timeoutMs?: number;
}

/** Deterministic 31-bit seed from the prompt so the URL (and image) is stable. */
function seedFrom(prompt: string): number {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) {
    h = (Math.imul(31, h) + prompt.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function buildUrl(prompt: string, opts: ImageOpts): string {
  const params = new URLSearchParams({
    width: String(opts.width ?? 1024),
    height: String(opts.height ?? 1024),
    model: opts.model ?? 'flux',
    seed: String(seedFrom(prompt)),
    nologo: 'true',
  });
  return `${BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`;
}

export async function generateImage(prompt: string, opts: ImageOpts = {}): Promise<ImageResult> {
  const url = buildUrl(prompt, opts);

  // Validate that Pollinations actually produced an image before claiming
  // success. The GET triggers generation; the client's <img> then re-fetches
  // the same (now-cached) seed-pinned URL.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const contentType = res.headers.get('content-type') ?? '';
    // Don't download the full body server-side — headers confirm success.
    res.body?.cancel().catch(() => {});
    if (!res.ok || !contentType.startsWith('image/')) {
      console.error(`[pollinations] HTTP ${res.status} content-type=${contentType}`);
      return { awaitingKey: false };
    }
    return { artifactUrl: url, previewUrl: url };
  } catch (err) {
    console.error('[pollinations] generateImage failed:', err instanceof Error ? err.message : err);
    return { awaitingKey: false };
  } finally {
    clearTimeout(timeout);
  }
}
