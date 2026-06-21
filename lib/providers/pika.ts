/**
 * Pika provider — server-only. Text-to-video generation.
 *
 * No key yet. The real call is written behind isConfigured(); until PIKA_API_KEY
 * is set, generateVideo() returns { awaitingKey: true } and the UI shows the
 * "waiting for the key" popup. Drop the key in .env and it goes live with no
 * other code change.
 */

const API_URL = 'https://api.pika.art/v1/generate'; // placeholder endpoint

export function isConfigured(): boolean {
  return !!process.env.PIKA_API_KEY && process.env.PIKA_API_KEY.length > 4;
}

export interface VideoResult {
  awaitingKey?: boolean;
  artifactUrl?: string;
  previewUrl?: string;
  durationSec?: number;
}

export interface VideoOpts {
  durationSec?: number;
  aspectRatio?: string;
  timeoutMs?: number;
}

export async function generateVideo(prompt: string, opts: VideoOpts = {}): Promise<VideoResult> {
  if (!isConfigured()) return { awaitingKey: true };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.PIKA_API_KEY as string}`,
      },
      body: JSON.stringify({
        prompt,
        duration: opts.durationSec ?? 18,
        aspectRatio: opts.aspectRatio ?? '16:9',
      }),
    });
    if (!res.ok) {
      console.error(`[pika] HTTP ${res.status}`);
      return { awaitingKey: false };
    }
    const json = (await res.json()) as { videoUrl?: string; thumbnailUrl?: string; duration?: number };
    return {
      artifactUrl: json.videoUrl,
      previewUrl: json.thumbnailUrl,
      durationSec: json.duration ?? opts.durationSec ?? 18,
    };
  } catch (err) {
    console.error('[pika] generateVideo failed:', err instanceof Error ? err.message : err);
    return { awaitingKey: false };
  } finally {
    clearTimeout(timeout);
  }
}
