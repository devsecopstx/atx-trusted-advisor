---
id: atx-brand
name: atx-brand
description: Brand and marketing design reviewer for atxFinance. Evaluates visual consistency, fintech credibility, legibility, mobile composition, and xAI/Grok/xMoney integration quality. Use when reviewing branding, hero images, social creatives, landing visuals, design systems, or dark-mode fintech UI style.
---

# atxFinance Brand Design Review

## Goal

Run a strict design QA pass so atxFinance assets stay premium, legible, and consistent with the 2026 refresh across social, web, and store surfaces.

## Use This Skill When

- User asks for brand review, marketing review, hero image review, visual QA, or design-system consistency checks.
- Work includes atxFinance visuals featuring xAI, Grok, xMoney, or mobile fintech UI mockups.
- Need pass/fail criteria before shipping social or app-store marketing creatives.

## Brand North Star

- **Aesthetic:** modern, sleek, futuristic fintech.
- **Tone:** professional and trustworthy, but approachable.
- **Interface style:** dark-first, clean lines, low-noise, restrained glow.
- **Palette direction:** charcoal/neutral surfaces with controlled cyan/violet accents.

## Canonical Source

Review against:

- `branding/atxfinance-branding-tags.md`
- `branding/atxfinance-color-palette.md`
- `branding/atxfinance-typography.md`
- `branding/atxfinance-brand-prompts.md`
- `design-system/atxfinance-brand-kit.md`

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Scoring Rubric (0-5 each)

- **Brand Accuracy:** naming, logos, product labeling.
- **Legibility:** typography, contrast, readability on mobile.
- **Composition:** hierarchy, balance, focal flow.
- **Visual Craft:** polish, lighting, depth, consistency.
- **Fintech Credibility:** believable UI data patterns and payment semantics.
- **Tag Compliance:** includes required identity tags and avoids blocked tags.

**Release threshold:** average `>= 4.3`, no `Critical` findings, and tag compliance `>= 4.5`.

## Failure Severity

- **Critical:** misspelled brand text, gibberish UI, unreadable key text, misleading financial UI.
- **Critical:** missing identity terms (`atxFinance`, `Powered by xAI`, `Grok`, `xMoney`) in a required hero context.
- **Major:** weak hierarchy, noisy effects, inconsistent palette, low mobile clarity.
- **Minor:** polish issues, spacing inconsistencies, small icon/alignment defects.

## Output Format

Return findings first, highest severity to lowest:

```markdown
## Findings
- Critical: <issue> -> <why it hurts trust or conversion> -> <exact fix>
- Major: <issue> -> <impact> -> <exact fix>
- Minor: <issue> -> <impact> -> <exact fix>

## Scorecard
- Brand Accuracy: X/5
- Legibility: X/5
- Composition: X/5
- Visual Craft: X/5
- Fintech Credibility: X/5
- Tag Compliance: X/5
- Average: X/5

## Ship Decision
- Ship / Ship with edits / Block

## Quick Fix Plan
1. <highest impact fix>
2. <next fix>
3. <final polish>
```

## Default Remediation Rules

1. Fix text correctness before any style tweaks.
2. Improve readability and contrast before adding effects.
3. Reduce visual noise before adding new motifs.
4. Preserve brand palette consistency across all cards and UI states.
5. Keep social-ready crops safe for 4:5 and center-weighted framing.
6. If identity tags are missing, block shipment and regenerate prompt first.

## Optional Project Context

If available, align reviews with:

- `design-system/atxfinance-brand-kit.css`
- `design-system/atxfinance-brand-kit.md`

If unavailable, use this skill's checklist and rubric as the source of truth.
