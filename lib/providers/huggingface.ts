/**
 * Hugging Face provider — server-only. Text-to-video via Inference Providers.
 *
 * Uses the official @huggingface/inference SDK, which handles provider routing
 * (fal-ai / Together / Replicate), polling, and response normalization — HF has
 * no first-party video host, so a hand-rolled fetch to api-inference/hf-inference
 * does NOT work for video.
 *
 * Needs a user access token (hf_…) with the "Inference Providers" permission.
 * Until HF_API_KEY is set, generateVideo() returns { awaitingKey: true } and the
 * UI shows the "waiting for the key" popup.
 *
 * ⚠️ Credits: video routes to PAID third-party providers. A free token's monthly
 * included credit is tiny (and is often already depleted), in which case the SDK
 * throws "You have depleted your monthly included credits…" — we catch that and
 * fall back to a render-failed deliverable. Buy pre-paid credits or HF PRO to use
 * this in earnest.
 *
 * Env:
 *   HF_API_KEY        — required to go live
 *   HF_VIDEO_MODEL    — default 'Wan-AI/Wan2.2-T2V-A14B'
 *   HF_VIDEO_PROVIDER — optional ('fal-ai' | 'together' | 'replicate' | 'auto')
 *
 * The SDK returns a Blob of raw video bytes. We persist it to
 * public/generated/*.mp4 (served by Next at /generated/…) and hand the client a
 * small URL instead of streaming a multi-MB data URI over SSE.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { InferenceClient } from '@huggingface/inference';

const MODEL = process.env.HF_VIDEO_MODEL ?? 'Wan-AI/Wan2.2-T2V-A14B';
const PROVIDER = process.env.HF_VIDEO_PROVIDER as
  | 'fal-ai' | 'together' | 'replicate' | 'auto' | undefined;

const OUT_DIR = join(process.cwd(), 'public', 'generated');

export function isConfigured(): boolean {
  return !!process.env.HF_API_KEY && process.env.HF_API_KEY.length > 4;
}

export interface VideoResult {
  awaitingKey?: boolean;
  artifactUrl?: string;
  previewUrl?: string;
  durationSec?: number;
}

export interface VideoOpts {
  durationSec?: number;
  timeoutMs?: number;
}

/** Deterministic 31-bit hash of the prompt for a stable output filename. */
function hashOf(prompt: string): string {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (Math.imul(31, h) + prompt.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export async function generateVideo(prompt: string, opts: VideoOpts = {}): Promise<VideoResult> {
  if (!isConfigured()) return { awaitingKey: true };

  const controller = new AbortController();
  // Video inference is slow (and may cold-start the model); allow generous time.
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 90_000);
  try {
    const hf = new InferenceClient(process.env.HF_API_KEY as string);
    const blob = await hf.textToVideo(
      {
        model: MODEL,
        inputs: prompt,
        ...(PROVIDER ? { provider: PROVIDER } : {}),
      },
      { signal: controller.signal },
    );

    const bytes = Buffer.from(await blob.arrayBuffer());
    if (bytes.byteLength < 1024) {
      console.error('[huggingface] response too small to be a video:', bytes.byteLength);
      return { awaitingKey: false };
    }
    await mkdir(OUT_DIR, { recursive: true });
    const file = `vid_${hashOf(prompt)}.mp4`;
    await writeFile(join(OUT_DIR, file), bytes);
    return {
      artifactUrl: `/generated/${file}`,
      previewUrl: `/generated/${file}`,
      durationSec: opts.durationSec ?? 5,
    };
  } catch (err) {
    // Includes "depleted your monthly included credits", 401 bad token, 404
    // stale model mapping, timeouts, etc. Never throw — the agent falls back.
    console.error('[huggingface] generateVideo failed:', err instanceof Error ? err.message : err);
    return { awaitingKey: false };
  } finally {
    clearTimeout(timeout);
  }
}
