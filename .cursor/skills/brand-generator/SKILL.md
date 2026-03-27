---
id: brand-generator
name: brand-generator
description: Generates premium atxFinance brand asset prompts and creative variants for mobile fintech marketing. Use when creating hero images, social creatives, app-store visuals, or campaign art featuring xAI, Grok, and xMoney.
---

# atxFinance Brand Generator

## Goal

Generate high-signal prompts and variants that match the 2026 atxFinance brand refresh and produce mobile-legible, conversion-ready assets.

## Canonical Source

Always align output with:

- `atx-docs/branding/atxfinance-brand-prompts.md`
- `atx-docs/branding/atxfinance-branding-tags.md`
- `atx-docs/branding/atxfinance-color-palette.md`
- `atx-docs/branding/atxfinance-typography.md`
- `atx-docs/design-system/atxfinance-brand-kit.md`

## Required Identity Lock

Every generated hero/campaign prompt must include:

- `atxFinance`
- `Powered by xAI`
- `Grok`
- `xMoney`

If one is missing, treat output as invalid and regenerate.

## Mandatory Tag Stack

Inject these tags by default unless user explicitly opts out:

```text
brand:atxFinance brand:poweredByXai entity:grokAssistant entity:xmoneyRails
style:premiumFintech style:darkFirst style:lowNoise style:cleanGeometry
layout:mobileFirst layout:centerSafe70 layout:focalPhoneMockup
trust:legibleAtMobile trust:believableFinancialUi trust:noHypeClaims
block:gibberishText block:misspelledBranding block:misleadingFinancialValues
```

## Prompt Workflow

1. Identify objective: awareness, trust, conversion, launch, or store listing.
2. Choose format: social `4:5`, landing `16:9`, or app-store screenshot.
3. Apply identity lock + mandatory tags.
4. Specify believable UI modules: portfolio, chart, Grok assistant, xMoney activity.
5. Add negative constraints for text integrity and financial credibility.
6. Return one primary prompt and three variants.

## Output Format (Required)

```markdown
## Primary Prompt
<prompt>

## Variant Prompts
1. <enterprise trust>
2. <growth momentum>
3. <ai-first>

## Tags Applied
<space-separated tags>

## Negative Constraints
- <constraint list>

## Recommended Crop/Export
- <ratio and safe-zone guidance>
```

## Footer & compliance tone (product chrome)

- Footers and shared chrome use **professional** disclaimers only (e.g. *Not financial advice*, risk of loss, for approved users).
- **Do not** suggest or ship ironic / meme legal lines (including any variant of “don’t sue me bro”) in footers, heroes, or store assets.

## Validation Before Returning

- No gibberish text
- No misspelled brand terms
- No over-saturated neon bloom
- No fake or extreme financial values
- Legible at mobile scale

## Optional Deliverables

When asked, also provide:

- Expo-ready `assets/` naming scaffold
- dark/light token recommendations using `atx-docs/branding/atxfinance-color-palette.md`
- `app.json` or `app.config.ts` icon/splash snippet
