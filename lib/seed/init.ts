/**
 * Seed the in-memory store with fixture data on startup.
 * Call once — idempotent (checks if already seeded).
 *
 * Boot-time hydration:
 *   If REDIS_URL is set and Redis contains data, the store is hydrated from Redis
 *   and the normal seed is skipped. If Redis is empty or unavailable, the normal
 *   seed runs and mirror calls fire so new data is written to Redis going forward.
 *
 * Ordering guarantee:
 *   1. Fixtures are written directly to the in-memory maps (no mirror calls) so
 *      the very first request never sees an empty store.
 *   2. Async hydration runs concurrently. If Redis had data it overwrites the
 *      fixture defaults in-memory — Redis wins.
 *   3. If hydration returns true we do NOT call mirrorFixtures(): the persisted
 *      Redis state is already authoritative.
 *   4. If hydration returns false (Redis empty or unconfigured) we call
 *      mirrorFixtures() to push the fixtures into Redis so they survive the next
 *      restart (no-op when REDIS_URL is unset because getRedis() returns null).
 *
 * This eliminates the critical race where the synchronous seed fired mirror
 * calls that overwrote persisted Redis state before hydration could read it.
 */

import store from '../store';
import {
  SEED_AGENTS, SEED_BOUNTIES, HERO_BOUNTY_ID, HERO_REQUIREMENTS,
} from './fixtures';
import type { Escrow } from '../types';
import { hydrateFromRedis } from '../redis/hydrate';
import {
  mirrorAgent, mirrorBounty, mirrorEscrow,
} from '../redis/mirror';

let seeded = false;

export function seedStore() {
  if (seeded) return;
  seeded = true;

  // Step 1: Write fixtures directly to in-memory maps (no mirror calls).
  // This guarantees the first request always sees data regardless of Redis timing.
  seedInMemory();

  // Step 2: Kick off async hydration. If Redis has data it overwrites the
  // fixture defaults in-memory so persisted state wins. This is fire-and-forget
  // from the synchronous call site — the in-memory store is immediately available.
  hydrateFromRedis(store).then((hydrated) => {
    if (hydrated) {
      console.log('[seed] Store hydrated from Redis — fixture seed was in-memory only');
      return;
    }
    // Redis was empty or not configured — mirror the fixtures we already seeded
    // so they are durable on the next restart.
    console.log('[seed] Redis empty or not configured — mirroring fixture seed to Redis');
    mirrorFixtures();
  }).catch((err) => {
    console.error('[seed] Hydration error — fixture seed remains in-memory only:', err);
    // Mirror fixtures anyway so a transient hydration failure doesn't leave
    // Redis permanently empty.
    mirrorFixtures();
  });
}

/**
 * Write fixture data directly into the in-memory store maps, bypassing the
 * store's public setXxx() methods so no mirror calls fire.
 * This is intentional: we must not touch Redis until we know whether hydration
 * will overwrite these values (to avoid the seed/hydration race condition).
 */
function seedInMemory() {
  // Skip if agents already populated (e.g. this module was somehow loaded twice).
  if (store.agents.size > 0) return;

  // Agents — write direct to map + leaderboard
  for (const agent of SEED_AGENTS) {
    store.agents.set(agent.agentId, agent);
    store.leaderboard.zadd(agent.agentId, agent.reputation);
  }

  // Bounties — write direct to map
  for (const bounty of SEED_BOUNTIES) {
    store.bounties.set(bounty.bountyId, bounty);
  }

  // Attach requirements to hero bounty (mutate in-place; already in the map)
  const hero = store.bounties.get(HERO_BOUNTY_ID);
  if (hero) {
    hero.requirements = HERO_REQUIREMENTS;
    hero.requirementsId = `req-${HERO_BOUNTY_ID}`;
  }

  // Escrow for hero bounty — write direct to map
  const escrow: Escrow = {
    escrowId: `escrow-${HERO_BOUNTY_ID}`,
    bountyId: HERO_BOUNTY_ID,
    amountUsd: 500,
    status: 'held',
    fundedAt: new Date().toISOString(),
  };
  store.escrows.set(escrow.bountyId, escrow);
}

/**
 * Mirror the already-seeded fixture data to Redis.
 * Called only after hydration confirms Redis was empty (or failed), so we
 * never overwrite real persisted data.
 */
function mirrorFixtures() {
  for (const agent of store.agents.values()) {
    mirrorAgent(agent).catch(() => {});
  }
  for (const bounty of store.bounties.values()) {
    mirrorBounty(bounty).catch(() => {});
  }
  for (const escrow of store.escrows.values()) {
    mirrorEscrow(escrow).catch(() => {});
  }
}
