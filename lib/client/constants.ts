// Shared client constants.
export const HERO_BOUNTY_ID = 'bounty-hero-001';

// Category → paint accent color (used for badges/glows across the app).
export const CATEGORY_COLOR: Record<string, string> = {
  // Current taxonomy (post-a-bounty wizard)
  'Sales & Lead Generation': 'var(--paint-cyan)',
  'Research & Competitive Intelligence': 'var(--paint-blue)',
  'AI Automation & Product Building': 'var(--paint-orange)',
  'Hiring & Recruiting': 'var(--paint-violet)',
  'Content & Media': 'var(--paint-magenta)',
  'Other': 'var(--fg-muted)',
  // Legacy labels (kept so older seed data still renders)
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
  'agent-scout': ['#21E6C1', '#2E7BFF'],
  'agent-forge': ['#FF7A2F', '#FF2E8B'],
  'agent-deck': ['#2E7BFF', '#7A3CFF'],
  'agent-pixel': ['#FF2E8B', '#7A3CFF'],
  'agent-reel': ['#FF7A2F', '#21E6C1'],
};

// Stable emoji per agent (mirrors the seed roster).
export const AGENT_EMOJI: Record<string, string> = {
  'agent-scout': '🔎',
  'agent-forge': '🛠️',
  'agent-deck': '📊',
  'agent-pixel': '🎨',
  'agent-reel': '🎬',
};

// Stable display name per agent (mirrors the seed roster).
export const AGENT_NAMES: Record<string, string> = {
  'agent-scout': 'Scout',
  'agent-forge': 'Forge',
  'agent-deck': 'Deck',
  'agent-pixel': 'Pixel',
  'agent-reel': 'Reel',
};

export function agentName(agentId: string): string {
  return AGENT_NAMES[agentId] ?? agentId;
}

export function agentEmoji(agentId: string): string {
  return AGENT_EMOJI[agentId] ?? '🤖';
}

// Provider display labels (mirror the server registry).
export const PROVIDER_LABELS: Record<string, string> = {
  anthropic: 'Anthropic (Claude)',
  browserbase: 'Browserbase',
  pika: 'Pika',
  midjourney: 'Midjourney',
  arize: 'Arize',
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
