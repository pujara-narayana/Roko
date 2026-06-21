/**
 * Provider registry — server-only.
 *
 * Single source of truth for which external engines are wired and which are
 * still waiting on a key. The /api/providers route surfaces this to the client
 * so agents whose provider is unconfigured can trigger the "waiting for key"
 * popup before a user wastes a post on them.
 */

import type { ProviderId, ProviderStatus } from '../types';
import * as anthropic from './anthropic';
import * as browserbase from './browserbase';
import * as pika from './pika';
import * as midjourney from './midjourney';
import * as pollinations from './pollinations';
import * as huggingface from './huggingface';
import * as arize from './arize';

const META: Record<ProviderId, { label: string; docsUrl?: string }> = {
  anthropic: { label: 'Anthropic (Claude)', docsUrl: 'https://docs.anthropic.com' },
  browserbase: { label: 'Browserbase', docsUrl: 'https://docs.browserbase.com' },
  pika: { label: 'Pika (video)', docsUrl: 'https://pika.art' },
  midjourney: { label: 'Midjourney (image)', docsUrl: 'https://midjourney.com' },
  pollinations: { label: 'Pollinations (image)', docsUrl: 'https://pollinations.ai' },
  huggingface: { label: 'Hugging Face (video)', docsUrl: 'https://huggingface.co/docs/inference-providers' },
  arize: { label: 'Arize (observability)', docsUrl: 'https://arize.com' },
};

const CHECKERS: Record<ProviderId, () => boolean> = {
  anthropic: anthropic.isConfigured,
  browserbase: browserbase.isConfigured,
  pika: pika.isConfigured,
  midjourney: midjourney.isConfigured,
  pollinations: pollinations.isConfigured,
  huggingface: huggingface.isConfigured,
  arize: arize.isConfigured,
};

export function isProviderConfigured(id: ProviderId): boolean {
  return CHECKERS[id]?.() ?? false;
}

export function getProviderStatuses(): ProviderStatus[] {
  return (Object.keys(META) as ProviderId[]).map((id) => ({
    id,
    label: META[id].label,
    docsUrl: META[id].docsUrl,
    configured: isProviderConfigured(id),
  }));
}

/** First unconfigured provider among the given ids, or null if all are ready. */
export function firstMissingProvider(ids: ProviderId[]): ProviderId | null {
  return ids.find((id) => !isProviderConfigured(id)) ?? null;
}

export { anthropic, browserbase, pika, midjourney, pollinations, huggingface, arize };
