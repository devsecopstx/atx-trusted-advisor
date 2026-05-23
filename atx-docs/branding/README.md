# atxFinance Branding Docs

This folder contains image assets plus the 2026 refresh docs used by prompt generation and design review workflows.

## Public marketing screenshots (shipped UI captures)

Product-facing proof assets for CTAs (X, website hero, LinkedIn carousel, email digest) live outside this folder at **`public/marketing-screenshots/`** — served as **`/marketing-screenshots/<filename>`**. Full index with per-channel usage: [`xchat/xfinance-branding-review.md`](../xchat/xfinance-branding-review.md) §9. Reference from UX/perf baseline: [`design-system/current-state-features.md`](../design-system/current-state-features.md) § UX performance.

## Documents

- `atxfinance-brand-prompts.md`: canonical prompt templates and variants
- `atxfinance-branding-tags.md`: reusable tag taxonomy and presets
- `atxfinance-color-palette.md`: color tokens and usage rules
- `atxfinance-typography.md`: typography system and readability constraints
- `atxfinance-brand-validation.md`: prompt dry-run and QA scorecard

## Product briefs (GTM)

- [product/xchat-product-brief.md](../product/xchat-product-brief.md)
- [product/xoptions-product-brief.md](../product/xoptions-product-brief.md)

## Workflow

1. Start from `atxfinance-brand-prompts.md`.
2. Apply relevant preset from `atxfinance-branding-tags.md`.
3. Validate generated outputs with `.cursor/skills/design-branding/SKILL.md` (and `brand-generator` when generating assets).
4. Record findings in `atxfinance-brand-validation.md` (or new batch-specific validation docs).
