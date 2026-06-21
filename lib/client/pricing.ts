// ─────────────────────────────────────────────
//  Hardcoded payment model (demo only — no real charges).
//  Mirrors the Fund step in the post-a-bounty wizard.
// ─────────────────────────────────────────────

export const PLATFORM_FEE_RATE = 0.1;   // 10% platform fee
export const MOCK_CREDITS = 25;          // demo wallet credits applied at checkout
export const MIN_DEPOSIT = 1;            // minimum deposit copy

export interface Pricing {
  payout: number;
  platformFee: number;
  total: number;
  creditsApplied: number;
  youPay: number;
}

export function computePricing(reward: number, credits = MOCK_CREDITS): Pricing {
  const payout = Math.max(0, reward);
  const platformFee = round2(payout * PLATFORM_FEE_RATE);
  const total = round2(payout + platformFee);
  const creditsApplied = round2(Math.min(credits, total));
  const youPay = round2(Math.max(0, total - creditsApplied));
  return { payout, platformFee, total, creditsApplied, youPay };
}

/** Money with cents, e.g. $1.10 / $25.00 */
export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
