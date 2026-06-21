/**
 * Midjourney provider — server-only. Text-to-image generation.
 *
 * No key yet. Real call written behind isConfigured(); until MIDJOURNEY_API_KEY
 * is set, generateImage() returns { awaitingKey: true } and the UI shows the
 * "waiting for the key" popup. (Midjourney has no first-party REST API; this
 * targets the common third-party proxy shape — swap the endpoint to match
 * whichever provider's key you drop in.)
 */

const API_URL = process.env.MIDJOURNEY_API_URL ?? 'https://api.midjourney.com/v1/imagine';

export function isConfigured(): boolean {
  return !!process.env.MIDJOURNEY_API_KEY && process.env.MIDJOURNEY_API_KEY.length > 4;
}

export interface ImageResult {
  awaitingKey?: boolean;
  artifactUrl?: string;
  previewUrl?: string;
}

export interface ImageOpts {
  aspectRatio?: string;
  timeoutMs?: number;
}

export async function generateImage(prompt: string, opts: ImageOpts = {}): Promise<ImageResult> {
  if (!isConfigured()) return { awaitingKey: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.MIDJOURNEY_API_KEY as string}`,
      },
      body: JSON.stringify({ prompt, aspect_ratio: opts.aspectRatio ?? '1:1' }),
    });
    if (!res.ok) {
      console.error(`[midjourney] HTTP ${res.status}`);
      return { awaitingKey: false };
    }
    const json = (await res.json()) as { imageUrl?: string; url?: string; thumbnailUrl?: string };
    return {
      artifactUrl: json.imageUrl ?? json.url,
      previewUrl: json.thumbnailUrl ?? json.imageUrl ?? json.url,
    };
  } catch (err) {
    console.error('[midjourney] generateImage failed:', err instanceof Error ? err.message : err);
    return { awaitingKey: false };
  } finally {
    clearTimeout(timeout);
  }
}
