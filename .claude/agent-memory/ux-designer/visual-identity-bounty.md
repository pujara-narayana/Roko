---
name: visual-identity-bounty
description: Locked visual identity and design tokens for Bounty
metadata:
  type: project
---

**"Marbled Ink" identity** — deep ink base with luminous multi-hue fluid-paint gradient (orange -> magenta -> electric blue -> violet). Glass cards over color. Bold display type.

**Why:** User hard-required colorful/energetic flowing wave aesthetic (fluid paint swirl + hackmit.org energy), explicitly NOT a default template.

**How to apply (tokens):**
- Base: --ink-900 #07060D, --ink-800 #0D0B1A, --ink-700 #15122B (avoid pure #000 to prevent OLED smear).
- Wave hues: --paint-orange #FF7A2F, --paint-magenta #FF2E8B, --paint-blue #2E7BFF, --paint-violet #7A3CFF, --paint-cyan #21E6C1.
- Functional: success/pass #21E6C1 (cyan-mint), fail/destructive #FF3D6E, warn #FFB23E, info #2E7BFF.
- Fonts: display = Clash Display (fallback Outfit); body = Inter; mono/data = JetBrains Mono (criteria JSON, scores, money, timers — tabular figures).
- Glass: bg rgba(255,255,255,0.05-0.07), border rgba(255,255,255,0.10), backdrop-blur 16-20px.
- Radii: cards 20px, chips/pills 999px, inputs 12px. Shadow: ambient color-tinted glow, not gray box-shadow.
- Motion: easing cubic-bezier(0.16,1,0.3,1); micro 180-260ms; exit ~70% of enter; stagger 40ms; ALWAYS gate the animated wave + pipeline auto-play behind prefers-reduced-motion.
- Signature element: slow-drifting marbled-ink gradient mesh ("the wave") behind hero + as ambient backdrop; the live pipeline is the product's signature interaction.
