---
name: oracle-scoring
description: Oracle PASS gate, sub-score formula, and seeded verdict outcomes
metadata:
  type: project
---

Oracle at `lib/oracle/index.ts`. PASS gate: completeness >= 95 AND criteriaMatch >= 90 AND validity >= 90 AND overall >= 90 AND duplicates == 0.

Sub-score formulas:
- criteriaMatch = criteriaMatchPct * 0.7 + semanticScore * 0.3
- completeness = min(records.length / targetCount, 1) * 100 - dupCount * 5
- validity = validEmailCount / records.length * 100
- overall = criteriaMatch * 0.35 + completeness * 0.35 + validity * 0.30

Seeded outcomes:
- agent-alpha: FAIL (3 low-revenue companies + 3 duplicate entries)
- agent-beta: FAIL (5 invalid emails: malformed + fake domain)
- agent-charlie: PASS (20/20, 0 duplicates, all valid emails, overall=100)

Semantic stub scores: charlie=98, beta=82, alpha=70 (deterministic by agentId).
