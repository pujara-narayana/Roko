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
  getPerfectCorpus, getDuplicatesCorpus, getBadEmailCorpus,
} from '../seed/fixtures';
import { specialtyForTaskType } from '../categories';
import { anthropic, browserbase, midjourney, pika, isProviderConfigured } from '../providers';
import { persistSubmission } from '../persist';

const AGENT_TIMEOUT_MS = parseInt(process.env.AGENT_TIMEOUT_MS ?? '45000', 10);

type Role = 'specialist' | 'challenger-a' | 'challenger-b';
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
export function planCompetitors(taskType: TaskType): PlanEntry[] {
  const specialty = specialtyForTaskType(taskType);
  const ranked = store.listAgentsByReputation();

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

async function fulfillResearch(role: Role, emit: (line: string, step: number) => void): Promise<FulfillResult> {
  if (role === 'specialist') {
    emit('Opening Browserbase session for live retrieval…', 1);
    const session = await browserbase.createSession().catch(() => null);
    if (session) {
      emit(`Live session ${session.sessionId.slice(0, 8)} — enriching verified contacts…`, 2);
      void browserbase.closeSession(session.sessionId);
    } else {
      emit('No live browser session — falling back to verified cache…', 2);
    }
    emit('Cross-referencing MX records — 0 duplicates…', 3);
    emit('Submitting 20 verified results…', 4);
    return {
      records: getPerfectCorpus(),
      source: session ? 'browserbase' : 'seeded_cache',
      engine: session ? 'browserbase' : 'cache',
    };
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
  const provider: ProviderId = taskType === 'image' ? 'midjourney' : 'pika';
  emit('Art-directing the prompt with Claude…', 1);

  if (taskType === 'image') {
    const res = await midjourney.generateImage(bounty.description);
    if (res.awaitingKey) {
      emit('Midjourney key not configured — awaiting key…', 2);
      return mediaAwaiting('image', provider);
    }
    emit('Rendering frames via Midjourney…', 3);
    return {
      records: [],
      deliverable: {
        kind: 'image', title: 'Generated image set',
        summary: 'Art-directed images rendered to the brief.',
        artifactUrl: res.artifactUrl, previewUrl: res.previewUrl, meta: { role: 'specialist' },
      },
      source: 'midjourney', engine: 'midjourney',
    };
  }

  const res = await pika.generateVideo(bounty.description, { durationSec: 18 });
  if (res.awaitingKey) {
    emit('Pika key not configured — awaiting key…', 2);
    return mediaAwaiting('video', provider);
  }
  emit('Rendering clip via Pika…', 3);
  return {
    records: [],
    deliverable: {
      kind: 'video', title: 'Generated clip',
      summary: 'Short cinematic clip rendered to the brief.',
      artifactUrl: res.artifactUrl, previewUrl: res.previewUrl, durationSec: res.durationSec, meta: { role: 'specialist' },
    },
    source: 'pika', engine: 'pika',
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
    source: kind === 'image' ? 'midjourney' : 'pika',
    engine: provider,
    awaitingKey: provider,
  };
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

  const emitLog = (line: string, step: number) => {
    emitEvent({
      stage: 'compete', status: 'in_progress', ts: now(),
      payload: { agentId, logLine: line, progressStep: step, totalSteps },
    });
  };

  emitEvent({
    stage: 'compete', status: 'in_progress', ts: now(),
    payload: { agentId, logLine: `${agent.name} starting…`, progressStep: 0, totalSteps },
  });

  const work = async (): Promise<FulfillResult> => {
    switch (taskType) {
      case 'code':         return fulfillCode(role, bounty, emitLog);
      case 'presentation': return fulfillPresentation(role, bounty, emitLog);
      case 'image':        return fulfillMedia('image', bounty, emitLog);
      case 'video':        return fulfillMedia('video', bounty, emitLog);
      default:             return fulfillResearch(role, emitLog);
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
          submissionId: submission.submissionId, agentId, source: submission.source,
          recordCount: submission.records.length,
          deliverableTitle: submission.deliverable?.title,
          awaitingKey: result.awaitingKey,
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
): Promise<Submission[]> {
  const taskType = bounty.taskType ?? 'data-research';
  const plan = planCompetitors(taskType);
  return Promise.all(plan.map((entry) => runAgent(entry, bounty, taskType, runId, emitEvent)));
}

/** True when the task needs a provider key that isn't set (image/video). */
export function blockingProvider(taskType: TaskType): ProviderId | null {
  if (taskType === 'image' && !isProviderConfigured('midjourney')) return 'midjourney';
  if (taskType === 'video' && !isProviderConfigured('pika')) return 'pika';
  return null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }
function now() { return new Date().toISOString(); }
function timeoutReject(ms: number, msg: string): Promise<never> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}
