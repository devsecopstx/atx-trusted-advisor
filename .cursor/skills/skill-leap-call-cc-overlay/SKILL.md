---
name: skill-leap-call-cc-overlay
description: LEAP call plus covered-call overlay for leveraged bullish exposure with recurring premium. Use when the user asks for LEAP plus short-call income overlays on TSLA and similar high-beta names.
skill_family: options-strategy
last_updated: 2026-05-19
---

# skill LEAP Call + CC Overlay

## Core setup
- Hold longer-dated call for directional exposure.
- Sell shorter-dated OTM calls for yield against that exposure.
- Optimize for risk-defined upside participation plus recurring income.

## Guardrails
- Keep expiration ladder explicit (long leg much farther out).
- Include scenario where short call is threatened by sharp rallies.
- State that gains can be capped by overlay.

## Output format
1. Long LEAP structure.
2. Overlay call structure.
3. Return paths (flat/up/down).
4. Risk and adjustment rules.

## Skill maintenance

- **Family:** `options-strategy` — see [`skill-authoring.md`](../skill-authoring.md).
- **Last updated:** 2026-05-19 (bump frontmatter when guardrails or output format change).
