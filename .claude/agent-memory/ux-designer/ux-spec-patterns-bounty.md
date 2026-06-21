---
name: ux-spec-patterns-bounty
description: Layout and interaction patterns established in the Bounty UX spec (03-ux-spec.md) — reuse these in future screens
metadata:
  type: project
---

**Two-column sticky-rail layout for the Run view:** Left col 1–4 sticky (bounty summary + requirements + escrow + stage pips); right col 5–12 scrollable pipeline canvas. On tablet, rail collapses to 80px horizontal bar at top. This layout is the demo centerpiece — do not flatten it.

**Why:** The requirements must stay visible while the pipeline plays out so judges can cross-reference what the oracle is checking without scrolling.

**How to apply:** Any "live process" view that has static context + streaming output should use this split. Keep sticky rail max 320px wide on desktop.

---

**SSE event-to-UI mapping is canonical:** The event types `stage:start`, `agent:status`, `agent:submitted`, `oracle:start`, `oracle:verdict`, `settle:complete`, `run:complete` are the agreed contract between backend and frontend. The frontend engineer builds state machine transitions against these exact event types.

**Why:** These were locked in the spec so backend and frontend share one schema. Any deviation requires both sides to update.

**How to apply:** Reference the SSE event table in 03-ux-spec.md when wiring up frontend state or designing new pipeline stages.

---

**VerdictCard sub-score order is fixed:** always `criteriaMatch` → `completeness` → `validity`. Never reorder. Progress bars animate in after a 100ms delay relative to card entry.

**Why:** Demo consistency — judges read these in a fixed position each time; reordering creates confusion mid-presentation.

**How to apply:** Enforce in component props; do not allow dynamic ordering.

---

**"In-progress" guarantee for the pipeline:** Every stage must emit at least one visible status signal before the next event arrives. Backend heartbeat every 10s while agent is "Working". Oracle emits `oracle:start` before `oracle:verdict` per agent. This eliminates dead air during the demo.

**Why:** The non-functional requirement in requriements.md says no dead air; judges reading "stalled" is a demo failure.

**How to apply:** Backend engineer must implement the heartbeat and the oracle:start event. Frontend must show a pulse animation on "Working" AgentCards.

---

**Seeded FAIL agent spec (locked for demo):**
- Agent A: 14/20 criteriaMatch, 3 duplicates, 2 emails fail MX — overall FAIL
- Agent B: 5 emails fail domain validation — overall FAIL
- Agent C: 20/20 all criteria pass — PASS, settles escrow

**Why:** Demo success criteria require one visible rejection with specific readable reasons on screen. These reasons are seeded into the oracle fixture.

**How to apply:** Seed data must match these exact rejection reasons. VerdictCard renders them verbatim from oracle output. See [[visual-identity-bounty]] for color tokens (fail #FF3D6E, pass #21E6C1).
