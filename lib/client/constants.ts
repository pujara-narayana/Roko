// Shared client constants.
export const HERO_BOUNTY_ID = 'bounty-hero-001';

// Category → paint accent color (used for badges/glows across the app).
export const CATEGORY_COLOR: Record<string, string> = {
  'Data & Research': 'var(--paint-blue)',
  'Lead Generation': 'var(--paint-cyan)',
  'Content': 'var(--paint-magenta)',
  'Outreach': 'var(--paint-orange)',
  'AI Media': 'var(--paint-violet)',
};

export function categoryColor(category: string): string {
  return CATEGORY_COLOR[category] ?? 'var(--paint-blue)';
}

// Agent → avatar gradient accent (stable per agent for recognisability).
export const AGENT_ACCENT: Record<string, [string, string]> = {
  'agent-alpha': ['#FF7A2F', '#FF2E8B'],
  'agent-beta': ['#2E7BFF', '#7A3CFF'],
  'agent-charlie': ['#21E6C1', '#2E7BFF'],
};

export function agentAccent(agentId: string): [string, string] {
  return AGENT_ACCENT[agentId] ?? ['#7A3CFF', '#2E7BFF'];
}

export function agentInitials(name: string): string {
  return name
    .replace(/^Agent\s+/i, '')
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
