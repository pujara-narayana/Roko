/**
 * Seed the in-memory store with fixture data on startup.
 * Call once — idempotent (checks if already seeded).
 */

import store from '../store';
import {
  SEED_AGENTS, SEED_BOUNTIES, HERO_BOUNTY_ID, HERO_REQUIREMENTS,
} from './fixtures';
import type { Escrow } from '../types';

let seeded = false;

export function seedStore() {
  if (seeded) return;
  seeded = true;

  // Agents
  for (const agent of SEED_AGENTS) {
    store.setAgent(agent);
  }

  // Bounties
  for (const bounty of SEED_BOUNTIES) {
    store.setBounty(bounty);
  }

  // Attach requirements to hero bounty
  const hero = store.getBounty(HERO_BOUNTY_ID);
  if (hero) {
    hero.requirements = HERO_REQUIREMENTS;
    hero.requirementsId = `req-${HERO_BOUNTY_ID}`;
    store.setBounty(hero);
  }

  // Escrow for hero bounty
  const escrow: Escrow = {
    escrowId: `escrow-${HERO_BOUNTY_ID}`,
    bountyId: HERO_BOUNTY_ID,
    amountUsd: 500,
    status: 'held',
    fundedAt: new Date().toISOString(),
  };
  store.setEscrow(escrow);
}
