/**
 * Marketplace category taxonomy — matches the post-a-bounty wizard.
 *
 * Each category maps to a default task type and the agent specialty most likely
 * to win it. "Content & Media" spans image/video/presentation, so the concrete
 * task type is refined from the description via resolveTaskType().
 */

import type { TaskType, AgentSpecialty } from './types';

export interface Category {
  id: string;
  label: string;
  description: string;
  icon: string;            // emoji
  defaultTaskType: TaskType;
  specialties: AgentSpecialty[]; // specialties that compete here, best-first
}

export const CATEGORIES: Category[] = [
  {
    id: 'sales-lead-gen',
    label: 'Sales & Lead Generation',
    description: 'Find leads, enrich prospects, and support outbound sales work',
    icon: '🎯',
    defaultTaskType: 'data-research',
    specialties: ['research'],
  },
  {
    id: 'research-intel',
    label: 'Research & Competitive Intelligence',
    description: 'Research markets, competitors, companies, and decision context',
    icon: '🧭',
    defaultTaskType: 'data-research',
    specialties: ['research'],
  },
  {
    id: 'automation-product',
    label: 'AI Automation & Product Building',
    description: 'Build automations, prototypes, scripts, and product workflows',
    icon: '⚙️',
    defaultTaskType: 'code',
    specialties: ['code'],
  },
  {
    id: 'hiring-recruiting',
    label: 'Hiring & Recruiting',
    description: 'Source candidates, enrich profiles, and support recruiting pipelines',
    icon: '🧑‍💼',
    defaultTaskType: 'data-research',
    specialties: ['research'],
  },
  {
    id: 'content-media',
    label: 'Content & Media',
    description: 'Create, edit, research, and organize content or media assets',
    icon: '🎨',
    defaultTaskType: 'image',
    specialties: ['video', 'image', 'presentation'],
  },
  {
    id: 'other',
    label: 'Other',
    description: "Use this when the bounty doesn't fit another category",
    icon: '✦',
    defaultTaskType: 'data-research',
    specialties: ['research'],
  },
];

export function categoryByLabel(label: string): Category | undefined {
  return CATEGORIES.find((c) => c.label === label || c.id === label);
}

/**
 * Refine the concrete task type from the chosen category + free-text brief.
 * Keyword routing handles the multi-type "Content & Media" bucket.
 */
export function resolveTaskType(categoryLabel: string, brief: string): TaskType {
  const cat = categoryByLabel(categoryLabel);
  const text = brief.toLowerCase();

  // Keyword routing wins regardless of category, so an "Other" video still works.
  if (/\b(video|reel|clip|footage|animation|film|movie)\b/.test(text)) return 'video';
  if (/\b(image|photo|headshot|picture|logo|illustration|render|artwork|thumbnail)\b/.test(text)) return 'image';
  if (/\b(slide|deck|presentation|ppt|pitch deck|keynote|powerpoint)\b/.test(text)) return 'presentation';
  if (/\b(code|script|app|automation|api|integration|prototype|build a|website|bot)\b/.test(text)) return 'code';
  if (/\b(find|leads?|companies|contacts?|emails?|list of|prospects?|candidates?|research)\b/.test(text)) return 'data-research';

  return cat?.defaultTaskType ?? 'data-research';
}

const TASK_TYPE_TO_SPECIALTY: Record<TaskType, AgentSpecialty> = {
  'data-research': 'research',
  code: 'code',
  presentation: 'presentation',
  image: 'image',
  video: 'video',
};

export function specialtyForTaskType(taskType: TaskType): AgentSpecialty {
  return TASK_TYPE_TO_SPECIALTY[taskType];
}
