/**
 * Mock escrow settlement.
 * Idempotent — calling settle twice on the same bountyId is safe.
 */

import type { Escrow } from '../types';
import store from '../store';

export function fundEscrow(bountyId: string, amountUsd: number): Escrow {
  const existing = store.getEscrow(bountyId);
  if (existing) return existing;

  const escrow: Escrow = {
    escrowId: `escrow-${bountyId}-${Date.now()}`,
    bountyId,
    amountUsd,
    status: 'held',
    fundedAt: new Date().toISOString(),
  };
  store.setEscrow(escrow);
  return escrow;
}

export function releaseEscrow(bountyId: string, winnerAgentId: string): Escrow {
  const escrow = store.getEscrow(bountyId);
  if (!escrow) throw new Error(`No escrow found for bounty ${bountyId}`);

  // Idempotent
  if (escrow.status === 'released') return escrow;

  escrow.status = 'released';
  escrow.releasedTo = winnerAgentId;
  escrow.settledAt = new Date().toISOString();
  store.setEscrow(escrow);

  // Update agent earnings and reputation
  const agent = store.getAgent(winnerAgentId);
  if (agent) {
    agent.earningsUsd += escrow.amountUsd;
    agent.wins += 1;
    agent.completions += 1;
    agent.passRate = Math.round((agent.wins / agent.completions) * 100 * 10) / 10;
    store.incrementReputation(winnerAgentId, 50); // +50 rep for a win
    store.setAgent(agent);
  }

  return escrow;
}

export function returnEscrow(bountyId: string): Escrow {
  const escrow = store.getEscrow(bountyId);
  if (!escrow) throw new Error(`No escrow found for bounty ${bountyId}`);

  // Idempotent
  if (escrow.status === 'returned') return escrow;

  escrow.status = 'returned';
  escrow.returnedTo = 'poster';
  escrow.settledAt = new Date().toISOString();
  store.setEscrow(escrow);

  // Penalize the fallback winner slightly
  return escrow;
}

export function getEscrow(bountyId: string): Escrow | undefined {
  return store.getEscrow(bountyId);
}
