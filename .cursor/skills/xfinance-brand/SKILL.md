---
id: xfinance-brand
name: xfinance-brand
description: Brand and marketing design reviewer for xFinance. Evaluates visual consistency, fintech credibility, legibility, mobile composition, and xAI/Grok/xMoney integration quality. Use when reviewing branding, hero images, social creatives, landing visuals, design systems, or dark-mode fintech UI style.
---

# xFinance Brand Design Review

## Goal

Run a fast, adversarial design review for xFinance brand assets so outputs look premium, legible, consistent, and conversion-ready on mobile.

## Use This Skill When

- User asks for brand review, marketing review, hero image review, visual QA, or design-system consistency checks.
- Work includes xFinance visuals featuring xAI, Grok, xMoney, or mobile fintech UI mockups.
- Need pass/fail criteria before shipping social or app-store marketing creatives.

## Brand North Star

- **Aesthetic:** modern, sleek, futuristic fintech.
- **Tone:** professional and trustworthy, but approachable.
- **Interface style:** dark mode, clean lines, subtle neon accents (no visual noise).
- **Palette direction:** deep navy/black base, electric blue/cyan/ultraviolet-purple accents.

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Scoring Rubric (0-5 each)

- **Brand Accuracy:** naming, logos, product labeling.
- **Legibility:** typography, contrast, readability on mobile.
- **Composition:** hierarchy, balance, focal flow.
- **Visual Craft:** polish, lighting, depth, consistency.
- **Fintech Credibility:** believable UI data patterns and payment semantics.

**Release threshold:** average `>= 4.2` and no `Critical` findings.

## Failure Severity

- **Critical:** misspelled brand text, gibberish UI, unreadable key text, misleading financial UI.
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

## Optional Project Context

If available, align reviews with:

- `design-system/xfinance-brand-kit.css`
- `design-system/xfinance-brand-kit.md`

If unavailable, use this skill's checklist and rubric as the source of truth.
