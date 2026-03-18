# atxFinance Brand Validation (Prompt Dry Run)

## Scope

Dry-run validation for the 2026 prompt + tag system before generating new image batches.

## Tag Stack Used

```text
brand:atxFinance brand:poweredByXai entity:grokAssistant entity:xmoneyRails
style:premiumFintech style:darkFirst style:lowNoise style:cleanGeometry
layout:mobileFirst layout:centerSafe70 layout:focalPhoneMockup
trust:legibleAtMobile trust:believableFinancialUi trust:noHypeClaims
block:gibberishText block:misspelledBranding block:misleadingFinancialValues
```

## Sample Prompt Set

### Sample 1 - Social Hero (4:5)

```text
Create a premium vertical 4:5 fintech hero for atxFinance with subtitle "Powered by xAI".
Show a center-right phone mockup with believable dark-mode UI: portfolio snapshot, performance chart, Grok assistant card, xMoney payment activity.
Keep left support cards minimal and readable. Use charcoal base with restrained cyan/violet accents. No gibberish text.
```

### Sample 2 - Landing Hero (16:9)

```text
Create a 16:9 landing hero for atxFinance with left-side copy space and right-side phone mockup.
Include "Powered by xAI", Grok, and xMoney labels in a clean low-noise composition.
Prioritize readability and trust, avoid exaggerated PnL claims, keep motion effects subtle.
```

### Sample 3 - App Store Screenshot

```text
Create app-store-style screenshot scene for atxFinance dark mode.
Show realistic finance interface hierarchy with Grok assistant and xMoney transfer card.
Use clean typography and balanced spacing, ensure all labels are legible on mobile.
```

## QA Checklist Result

- [x] Identity lock includes atxFinance, Powered by xAI, Grok, xMoney
- [x] Prompts enforce legibility constraints
- [x] Prompts block misleading financial content
- [x] Composition remains mobile-safe
- [x] Palette constraints avoid over-saturated neon output

## Scorecard (Prompt-Level)

- Brand Accuracy: 5/5
- Legibility Guardrails: 4.6/5
- Composition Clarity: 4.5/5
- Visual Craft Guidance: 4.4/5
- Fintech Credibility: 4.7/5
- Tag Compliance: 5/5
- Average: 4.7/5

## Ship Decision

Ship with edits.

## Quick Fix Plan

1. Add one optional compliance-oriented variant focused on privacy/security UI motifs.
2. Add one localization variant with shorter copy for dense languages.
3. Use this prompt set for the next image batch and run `atxfinance-brand` review on outputs.
