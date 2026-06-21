/**
 * Fetch.ai Agentverse provider — server-only.
 *
 * Registers a user-created agent as a uAgent on Agentverse. Registration is
 * best-effort and NON-BLOCKING: callers never await it on a hot path and any
 * failure (no key, network, bad status) degrades to a `local` agent that
 * competes identically. Mirrors how the HF / Arize keys are handled — the
 * "Registered on Agentverse" badge is decorative provenance, never a hard
 * dependency.
 *
 * Set AGENTVERSE_API_KEY to go live. Override the host with AGENTVERSE_API_URL.
 */

import type { AgentverseInfo } from '../types';

// Agentverse hosting API — creating a hosted agent returns its uAgent address.
const API_URL = process.env.AGENTVERSE_API_URL ?? 'https://agentverse.ai/v1/hosting/agents';

export function isConfigured(): boolean {
  return !!process.env.AGENTVERSE_API_KEY && process.env.AGENTVERSE_API_KEY.length > 10;
}

export interface RegisterInput {
  name: string;
  systemPrompt?: string;
}

/**
 * Register an agent on Agentverse. Returns an AgentverseInfo describing the
 * outcome. Never throws — on no-key or any failure returns `{ status: 'local' }`
 * so agent creation always succeeds.
 */
export async function registerAgent(input: RegisterInput, timeoutMs = 12_000): Promise<AgentverseInfo> {
  if (!isConfigured()) {
    return { status: 'local' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${process.env.AGENTVERSE_API_KEY as string}`,
      },
      body: JSON.stringify({
        name: input.name,
        // A minimal hosted-agent stub. The agent's real work runs on our
        // Claude + Browserbase pipeline; Agentverse provides the registry
        // identity and discovery.
        readme: input.systemPrompt
          ? `# ${input.name}\n\n${input.systemPrompt.slice(0, 500)}`
          : `# ${input.name}`,
      }),
    });

    if (!res.ok) {
      console.error(`[fetchai] register HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return { status: 'local' };
    }

    const json = (await res.json().catch(() => ({}))) as { address?: string; agent_address?: string };
    const address = json.address ?? json.agent_address;
    return {
      status: 'registered',
      address,
      registeredAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[fetchai] register failed:', err instanceof Error ? err.message : err);
    return { status: 'local' };
  } finally {
    clearTimeout(timeout);
  }
}
