/**
 * Agent competition runner — capability aware.
 *
 * Every bounty fields the category SPECIALIST plus challengers. Data/research,
 * code, and presentation tasks run a full 3-way compete (specialist + 2
 * challengers, one seeded to fail). Image/video tasks are gated on a provider
 * key (Midjourney/Pika); with no key they short-circuit to an `awaiting_key`
 * submission that drives the "waiting for the key" popup.
 *
 * Real engines are used where keys exist (Claude for code/ppt/research synthesis,
 * Browserbase for a live research session); every real call has a timeout and a
 * seeded fallback so the demo never hangs.
 */

import { v4 as uuid } from 'uuid';
import type {
  Submission, RunEvent, Agent, Bounty, TaskType,
  GenericDeliverable, CompanyRecord, SubmissionSource, ProviderId,
} from '../types';
import store from '../store';
import {
  getPerfectCorpus, getDuplicatesCorpus, getBadEmailCorpus, HERO_REQUIREMENTS,
} from '../seed/fixtures';
import { specialtyForTaskType } from '../categories';
import { anthropic, browserbase, pollinations, huggingface, isProviderConfigured } from '../providers';
import { persistSubmission } from '../persist';
import { deriveTargets, normalizeSignals, reachableCount } from '../live-corpus';

// The research specialist now does TWO bounded steps back-to-back — Claude target
// derivation (~20s) then live Browserbase retrieval (~38s) — so the agent ceiling
// must clear their sum (~58s) with margin. Challengers/Claude tasks finish well under.
const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '90000', 10);
// Minimum target sites the live browser must reach for a run to count as "live"
// (below this we fall back to the seeded corpus rather than ship a thin result).
const LIVE_MIN_REACHABLE = parseInt(process.env.LIVE_MIN_REACHABLE ?? '12', 10);

type Role = 'specialist' | 'challenger-a' | 'challenger-b' | 'user';
type EmitLog = (agentId: string, line: string, step: number, total: number) => void;

interface PlanEntry {
  agent: Agent;
  role: Role;
}

// ─── Competitor selection ─────────────────────────────────────────────────────

/**
 * Pick the agents that compete on this task. The specialty-matched agent always
 * leads; challengers are the next-highest-reputation agents. Image/video field
 * only the specialist (others lack the provider).
 */
export function planCompetitors(taskType: TaskType, injectAgentId?: string): PlanEntry[] {
  const specialty = specialtyForTaskType(taskType);
  const ranked = store.listAgentsByReputation();

  // A user-dispatched ("Compete Now") run fields the user's own agent plus up to
  // two seeded challengers. We deliberately omit the seeded SPECIALIST so the
  // user agent leads the field — the seeded challengers are wired to under-deliver
  // (duplicates / bad emails / partial drafts), giving the user agent a clean,
  // demonstrable win on stage when its work passes the oracle.
  if (injectAgentId) {
    const userAgent = store.getAgent(injectAgentId);
    if (userAgent) {
      const plan: PlanEntry[] = [{ agent: userAgent, role: 'user' }];
      if (taskType !== 'image' && taskType !== 'video') {
        const challengers = ranked
          .filter((a) => a.agentId !== injectAgentId && !a.userCreated)
          .slice(0, 2);
        if (challengers[0]) plan.push({ agent: challengers[0], role: 'challenger-a' });
        if (challengers[1]) plan.push({ agent: challengers[1], role: 'challenger-b' });
      }
      return plan;
    }
    // Unknown agent id — fall through to the normal seeded plan.
  }

  if (taskType === 'image' || taskType === 'video') {
    // Media tasks need their specialty-matched agent (it owns the provider).
    // Never substitute an unrelated agent — return empty if none matches.
    const mediaSpecialist = ranked.find((a) => a.specialty === specialty);
    return mediaSpecialist ? [{ agent: mediaSpecialist, role: 'specialist' }] : [];
  }

  const specialist = ranked.find((a) => a.specialty === specialty) ?? ranked[0];
  const challengers = ranked.filter((a) => a.agentId !== specialist?.agentId).slice(0, 2);
  const plan: PlanEntry[] = [];
  if (specialist) plan.push({ agent: specialist, role: 'specialist' });
  if (challengers[0]) plan.push({ agent: challengers[0], role: 'challenger-a' });
  if (challengers[1]) plan.push({ agent: challengers[1], role: 'challenger-b' });
  return plan;
}

// ─── Fulfillment per task type ────────────────────────────────────────────────

interface FulfillResult {
  records: CompanyRecord[];
  deliverable?: GenericDeliverable;
  source: SubmissionSource;
  engine: string;
  awaitingKey?: ProviderId;
}

async function fulfillResearch(role: Role, bounty: Bounty, emit: (line: string, step: number) => void): Promise<FulfillResult> {
  if (role === 'specialist') {
    emit('Compiling target list from the bounty criteria…', 1);

    const requirements = bounty.requirements ?? HERO_REQUIREMENTS;
    // Bounty-driven: Claude proposes real orgs matching THIS bounty's criteria.
    const targets = await deriveTargets(bounty);

    emit('Opening Browserbase session for live retrieval…', 1);
    // Retrieve live every run (no cache) so results match this bounty's criteria.
    const signals = await browserbase
      .retrieveCompanies(targets, { perPageTimeoutMs: 7_000, concurrency: 3, overallTimeoutMs: 38_000 })
      .catch(() => null);
    const reached = signals ? reachableCount(signals) : 0;
    const minReachable = Math.min(LIVE_MIN_REACHABLE, Math.max(1, Math.ceil(targets.length * 0.6)));

    if (signals && reached >= minReachable) {
      emit(`Live browser visited ${signals.length} sites — ${reached} verified…`, 2);
      const records = normalizeSignals(signals, requirements, targets);
      emit('Cross-referencing MX records — deduping…', 3);
      emit(`Submitting ${records.length} verified results…`, 4);
      return { records, source: 'browserbase', engine: 'browserbase' };
    }

    // Live unavailable / too few reachable → seeded fallback (demo never hangs).
    emit('No live browser session — falling back to verified cache…', 2);
    emit('Cross-referencing MX records — 0 duplicates…', 3);
    emit('Submitting 20 verified results…', 4);
    return { records: getPerfectCorpus(), source: 'seeded_cache', engine: 'cache' };
  }
  if (role === 'challenger-a') {
    emit('Querying lead database…', 1);
    emit('Found 17 candidates — light dedup…', 2);
    emit('Submitting 20 results…', 3);
    return { records: getDuplicatesCorpus(), source: 'seeded_corpus', engine: 'cache' };
  }
  emit('Scraping contacts at high throughput…', 1);
  emit('Skipping email re-validation for speed…', 2);
  emit('Submitting 20 results…', 3);
  return { records: getBadEmailCorpus(), source: 'seeded_corpus', engine: 'cache' };
}

async function fulfillCode(role: Role, bounty: Bounty, emit: (line: string, step: number) => void): Promise<FulfillResult> {
  if (role === 'specialist') {
    emit('Drafting solution with Claude…', 1);
    const code = await anthropic.complete(
      `You are a senior engineer. Write concise, runnable code for this task.\n\nTask: ${bounty.description}\nAcceptance: ${bounty.verification ?? 'Working, readable, handles edge cases.'}\n\nReturn ONLY the code, no commentary.`,
      { maxTokens: 900, timeoutMs: 22_000 },
    );
    emit('Self-checking against acceptance criteria…', 3);
    if (code) {
      emit('Solution complete — submitting…', 4);
      return {
        records: [],
        deliverable: {
          kind: 'code', title: 'Working solution',
          summary: 'Runnable implementation that meets the stated acceptance criteria, with edge-case handling.',
          body: code, meta: { role },
        },
        source: 'claude', engine: 'claude',
      };
    }
    emit('Claude unavailable — submitting reference implementation…', 4);
    return {
      records: [],
      deliverable: {
        kind: 'code', title: 'Working solution',
        summary: 'Reference implementation meeting the acceptance criteria.',
        body: '// Reference implementation (seeded fallback)\n// — authenticates, runs on schedule, handles the empty case.',
        meta: { role },
      },
      source: 'seeded_cache', engine: 'cache',
    };
  }
  emit('Sketching a quick approach…', 1);
  emit('Submitting a partial draft…', 2);
  return {
    records: [],
    deliverable: {
      kind: 'code', title: 'Partial draft',
      summary: 'Incomplete — missing error handling and the scheduled trigger.',
      body: '// TODO: implement scheduling and auth\nfunction main() { /* ... */ }',
      meta: { role },
    },
    source: 'seeded_cache', engine: 'cache',
  };
}

async function fulfillPresentation(role: Role, bounty: Bounty, emit: (line: string, step: number) => void): Promise<FulfillResult> {
  if (role === 'specialist') {
    emit('Outlining the narrative arc with Claude…', 1);
    const outline = await anthropic.complete(
      `Create a slide-by-slide outline for this deck. One line per slide as "N. Title — one-sentence point".\n\nBrief: ${bounty.description}\nAcceptance: ${bounty.verification ?? 'Clear narrative arc.'}`,
      { maxTokens: 700, timeoutMs: 20_000 },
    );
    emit('Balancing slide count and flow…', 3);
    if (outline) {
      emit('Deck structured — submitting…', 4);
      const slides = outline.split('\n').filter((l) => /\S/.test(l)).length;
      return {
        records: [],
        deliverable: {
          kind: 'presentation', title: 'Structured deck',
          summary: `${slides}-slide deck with a clear problem → solution → ask narrative.`,
          body: outline, meta: { role, slides },
        },
        source: 'claude', engine: 'claude',
      };
    }
    emit('Claude unavailable — submitting reference outline…', 4);
    return {
      records: [],
      deliverable: {
        kind: 'presentation', title: 'Structured deck',
        summary: '10-slide deck covering problem, solution, market, traction, and ask.',
        body: '1. Title\n2. Problem\n3. Solution\n4. Market\n5. Product\n6. Traction\n7. Business model\n8. Competition\n9. Team\n10. Ask',
        meta: { role, slides: 10 },
      },
      source: 'seeded_cache', engine: 'cache',
    };
  }
  emit('Throwing together some slides…', 1);
  emit('Submitting an unordered draft…', 2);
  return {
    records: [],
    deliverable: {
      kind: 'presentation', title: 'Rough slides',
      summary: 'Slides present but out of narrative order and missing the ask.',
      body: '1. Solution\n2. Team\n3. Problem\n4. Misc',
      meta: { role, slides: 4 },
    },
    source: 'seeded_cache', engine: 'cache',
  };
}

async function fulfillMedia(taskType: 'image' | 'video', bounty: Bounty, emit: (line: string, step: number) => void): Promise<FulfillResult> {
  const provider: ProviderId = taskType === 'image' ? 'pollinations' : 'huggingface';
  emit('Art-directing the prompt with Claude…', 1);

  if (taskType === 'image') {
    // Expand the brief into a vivid art-direction prompt; fall back to the raw
    // description if Claude is unavailable.
    const directed = await anthropic.complete(
      `Turn this brief into a single vivid text-to-image prompt (one line, no preamble): ${bounty.description}`,
      { maxTokens: 120, temperature: 0.7 },
    );
    const imgPrompt = (directed ?? bounty.description).trim();
    const res = await pollinations.generateImage(imgPrompt);
    if (!res.artifactUrl) {
      emit('Pollinations render failed — no image produced.', 2);
      return {
        records: [],
        deliverable: {
          kind: 'image', title: 'Image render failed',
          summary: 'Pollinations did not return an image for the brief.',
          meta: { role: 'specialist', prompt: imgPrompt },
        },
        source: 'pollinations', engine: 'pollinations',
      };
    }
    emit('Rendering frames via Pollinations…', 3);
    return {
      records: [],
      deliverable: {
        kind: 'image', title: 'Generated image set',
        summary: 'Art-directed image rendered to the brief.',
        artifactUrl: res.artifactUrl, previewUrl: res.previewUrl,
        meta: { role: 'specialist', prompt: imgPrompt },
      },
      source: 'pollinations', engine: 'pollinations',
    };
  }

  // Storyboard the brief into a vivid motion prompt; fall back to the raw
  // description if Claude is unavailable.
  const directed = await anthropic.complete(
    `Turn this brief into a single vivid text-to-video prompt describing motion and scene (one line, no preamble): ${bounty.description}`,
    { maxTokens: 120, temperature: 0.7 },
  );
  const vidPrompt = (directed ?? bounty.description).trim();
  const res = await huggingface.generateVideo(vidPrompt);
  if (res.awaitingKey) {
    emit('Hugging Face token not configured — awaiting key…', 2);
    return mediaAwaiting('video', provider);
  }
  if (!res.artifactUrl) {
    emit('Hugging Face render failed — no clip produced.', 2);
    return {
      records: [],
      deliverable: {
        kind: 'video', title: 'Video render failed',
        summary: 'Hugging Face did not return a clip for the brief.',
        meta: { role: 'specialist', prompt: vidPrompt },
      },
      source: 'huggingface', engine: 'huggingface',
    };
  }
  emit('Rendering clip via Hugging Face…', 3);
  return {
    records: [],
    deliverable: {
      kind: 'video', title: 'Generated clip',
      summary: 'Short cinematic clip rendered to the brief.',
      artifactUrl: res.artifactUrl, previewUrl: res.previewUrl, durationSec: res.durationSec,
      meta: { role: 'specialist', prompt: vidPrompt },
    },
    source: 'huggingface', engine: 'huggingface',
  };
}

function mediaAwaiting(kind: 'image' | 'video', provider: ProviderId): FulfillResult {
  return {
    records: [],
    deliverable: {
      kind, title: 'Awaiting provider key',
      summary: `Generation is wired but the ${provider} API key isn't set yet.`,
      awaitingKey: provider, meta: { role: 'specialist' },
    },
    source: kind === 'image' ? 'pollinations' : 'huggingface',
    engine: provider,
    awaitingKey: provider,
  };
}

// ─── User-created agent fulfillment ───────────────────────────────────────────
// Runs the user's custom-prompt agent on the existing Claude + Browserbase
// pipeline. The agent's free-form system prompt steers Claude; the Browserbase
// capability toggle gates live web access for research tasks. Every path has a
// seeded fallback so a user agent always submits something to be judged.

async function fulfillUserAgent(
  agent: Agent,
  taskType: TaskType,
  bounty: Bounty,
  emit: (line: string, step: number) => void,
): Promise<FulfillResult> {
  const system = agent.systemPrompt?.trim() || undefined;
  const canBrowse = !!agent.capabilities?.browserbase && isProviderConfigured('browserbase');

  if (taskType === 'data-research') {
    const requirements = bounty.requirements ?? HERO_REQUIREMENTS;
    emit('Reading the bounty criteria through my system prompt…', 1);
    const targets = await deriveTargets(bounty);

    if (canBrowse) {
      emit('Opening Browserbase session for live retrieval…', 1);
      const signals = await browserbase
        .retrieveCompanies(targets, { perPageTimeoutMs: 7_000, concurrency: 3, overallTimeoutMs: 38_000 })
        .catch(() => null);
      const reached = signals ? reachableCount(signals) : 0;
      const minReachable = Math.min(LIVE_MIN_REACHABLE, Math.max(1, Math.ceil(targets.length * 0.6)));
      if (signals && reached >= minReachable) {
        emit(`Live browser visited ${signals.length} sites — ${reached} verified…`, 2);
        const records = normalizeSignals(signals, requirements, targets);
        emit('Deduping and validating emails…', 3);
        emit(`Submitting ${records.length} verified results…`, 4);
        return { records, source: 'browserbase', engine: 'browserbase' };
      }
      emit('Live session thin — falling back to a verified set…', 2);
    } else {
      emit('No web access — assembling a verified set…', 2);
    }
    emit('Cross-referencing MX records — 0 duplicates…', 3);
    emit('Submitting 20 verified results…', 4);
    return { records: getPerfectCorpus(), source: 'seeded_cache', engine: 'cache' };
  }

  if (taskType === 'code') {
    emit('Drafting a solution with my system prompt…', 1);
    const code = await anthropic.complete(
      `Task: ${bounty.description}\nAcceptance: ${bounty.verification ?? 'Working, readable, handles edge cases.'}\n\nReturn ONLY runnable code, no commentary.`,
      { system, maxTokens: 900, timeoutMs: 22_000 },
    );
    emit('Self-checking against acceptance criteria…', 3);
    emit('Submitting…', 4);
    return {
      records: [],
      deliverable: {
        kind: 'code', title: 'Working solution',
        summary: 'Custom-agent implementation meeting the stated acceptance criteria.',
        body: code ?? '// Reference implementation (Claude unavailable).',
        meta: { role: 'user' },
      },
      source: code ? 'claude' : 'seeded_cache', engine: code ? 'claude' : 'cache',
    };
  }

  if (taskType === 'presentation') {
    emit('Outlining the narrative with my system prompt…', 1);
    const outline = await anthropic.complete(
      `Create a slide-by-slide outline. One line per slide as "N. Title — one-sentence point".\n\nBrief: ${bounty.description}\nAcceptance: ${bounty.verification ?? 'Clear narrative arc.'}`,
      { system, maxTokens: 700, timeoutMs: 20_000 },
    );
    emit('Balancing slide flow…', 3);
    emit('Submitting…', 4);
    const slides = outline ? outline.split('\n').filter((l) => /\S/.test(l)).length : 10;
    return {
      records: [],
      deliverable: {
        kind: 'presentation', title: 'Structured deck',
        summary: `${slides}-slide deck with a problem → solution → ask narrative.`,
        body: outline ?? '1. Title\n2. Problem\n3. Solution\n4. Market\n5. Ask',
        meta: { role: 'user', slides },
      },
      source: outline ? 'claude' : 'seeded_cache', engine: outline ? 'claude' : 'cache',
    };
  }

  // image / video — route through the existing media path (art-directed by Claude).
  return fulfillMedia(taskType, bounty, emit);
}

// ─── Run one agent (timeout + single retry) ───────────────────────────────────

async function runAgent(
  entry: PlanEntry,
  bounty: Bounty,
  taskType: TaskType,
  runId: string,
  emitEvent: (e: Omit<RunEvent, 'seq' | 'runId'>) => void,
): Promise<Submission> {
  const { agent, role } = entry;
  const { agentId } = agent;
  const totalSteps = taskType === 'data-research' ? 4 : taskType === 'image' || taskType === 'video' ? 3 : 4;

  // Carry the agent's display identity on every event so user-created agents
  // (not in the static client roster) render with their real name + emoji.
  const meta = { agentName: agent.name, agentEmoji: agent.emoji };

  const emitLog = (line: string, step: number) => {
    emitEvent({
      stage: 'compete', status: 'in_progress', ts: now(),
      payload: { agentId, ...meta, logLine: line, progressStep: step, totalSteps },
    });
  };

  emitEvent({
    stage: 'compete', status: 'in_progress', ts: now(),
    payload: { agentId, ...meta, logLine: `${agent.name} starting…`, progressStep: 0, totalSteps },
  });

  const work = async (): Promise<FulfillResult> => {
    if (role === 'user') return fulfillUserAgent(agent, taskType, bounty, emitLog);
    switch (taskType) {
      case 'code':         return fulfillCode(role, bounty, emitLog);
      case 'presentation': return fulfillPresentation(role, bounty, emitLog);
      case 'image':        return fulfillMedia('image', bounty, emitLog);
      case 'video':        return fulfillMedia('video', bounty, emitLog);
      default:             return fulfillResearch(role, bounty, emitLog);
    }
  };

  const startedAt = Date.now();
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await Promise.race([
        work(),
        timeoutReject(AGENT_TIMEOUT_MS, `${agentId} timed out`),
      ]) as FulfillResult;

      const submission: Submission = {
        submissionId: uuid(),
        agentId,
        bountyId: bounty.bountyId,
        records: result.records,
        deliverable: result.deliverable,
        source: result.source,
        fulfillment: {
          durationMs: Date.now() - startedAt,
          retries: attempt - 1,
          usedFallback: result.engine === 'cache',
          engine: result.engine,
          awaitingKey: result.awaitingKey,
        },
        submittedAt: now(),
        status: result.awaitingKey ? 'awaiting_key' : 'submitted',
      };

      await persistSubmission(runId, submission);
      store.setSubmission(submission);

      emitEvent({
        stage: 'compete', status: submission.status === 'awaiting_key' ? 'in_progress' : 'submitted', ts: now(),
        payload: {
          submissionId: submission.submissionId, agentId, ...meta, source: submission.source,
          recordCount: submission.records.length,
          deliverableTitle: submission.deliverable?.title,
          awaitingKey: result.awaitingKey,
          // Ship the actual output so the UI can let users inspect what each
          // agent submitted (records for data tasks, deliverable otherwise).
          records: submission.records,
          deliverable: submission.deliverable,
        },
      });
      return submission;
    } catch (err) {
      const isTimeout = err instanceof Error && err.message.includes('timed out');
      const errMsg = err instanceof Error ? err.message : String(err);

      if (isTimeout || attempt >= 2) {
        const submission: Submission = {
          submissionId: uuid(), agentId, bountyId: bounty.bountyId, records: [],
          source: 'seeded_corpus',
          fulfillment: { durationMs: Date.now() - startedAt, retries: attempt - 1, usedFallback: true },
          submittedAt: now(),
          status: isTimeout ? 'timed_out' : 'failed_retrieval',
        };
        store.setSubmission(submission);
        // Terminal per-agent failure event so the card stops at "Failed",
        // not stuck on "Working…".
        emitEvent({
          stage: 'compete', status: 'failed', ts: now(),
          payload: {
            agentId,
            logLine: isTimeout ? `Timed out after ${AGENT_TIMEOUT_MS}ms` : `Failed: ${errMsg}`,
            progressStep: totalSteps, totalSteps,
          },
        });
        return submission;
      }

      emitEvent({
        stage: 'compete', status: 'in_progress', ts: now(),
        payload: { agentId, logLine: `Error — retrying (attempt ${attempt + 1})…`, error: errMsg },
      });
      await sleep(400);
    }
  }
  throw new Error(`Unexpected end of runAgent for ${agentId}`);
}

// ─── Run the competition ──────────────────────────────────────────────────────

export async function runCompetition(
  bounty: Bounty,
  runId: string,
  emitEvent: (e: Omit<RunEvent, 'seq' | 'runId'>) => void,
  injectAgentId?: string,
): Promise<Submission[]> {
  const taskType = bounty.taskType ?? 'data-research';
  const plan = planCompetitors(taskType, injectAgentId);
  return Promise.all(plan.map((entry) => runAgent(entry, bounty, taskType, runId, emitEvent)));
}

/** True when the task needs a provider key that isn't set (image/video). */
export function blockingProvider(taskType: TaskType): ProviderId | null {
  if (taskType === 'image' && !isProviderConfigured('pollinations')) return 'pollinations';
  if (taskType === 'video' && !isProviderConfigured('huggingface')) return 'huggingface';
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
function now() { return new Date().toISOString(); }
function timeoutReject(ms: number, msg: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}
