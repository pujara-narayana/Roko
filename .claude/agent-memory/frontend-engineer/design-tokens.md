---
name: design-tokens
description: Locked "Marbled Ink" design system tokens
metadata:
  type: reference
---

"Marbled Ink" — dark, ink base with paint-color accents. These tokens WIN over any skill default.

Colors: ink-900 #07060D, ink-800 #0D0B1A, ink-700 #15122B; paint-orange #FF7A2F, paint-magenta #FF2E8B, paint-blue #2E7BFF, paint-violet #7A3CFF, paint-cyan #21E6C1; success #21E6C1, danger #FF3D6E, warn #FFB23E; fg #F4F2FF, fg-muted #A39FC4; border rgba(255,255,255,0.10).

Fonts: display = Clash Display (Outfit fallback), body = Inter, mono = JetBrains Mono. ALL data/money/scores use mono with tabular-nums.

Radius: card 20px, pill 999px. Glass panels: bg rgba(255,255,255,0.05) + 1px border + backdrop-blur(18px). Color-tinted glows, never gray shadows. Easing cubic-bezier(0.16,1,0.3,1); micro 180-260ms. CTA gradient linear-gradient(100deg,#FF2E8B,#7A3CFF,#2E7BFF).

Wave hero: animated multi-radial-gradient mesh (--wave-mesh) with slow drift + a second blurred parallax layer; freeze under prefers-reduced-motion.
