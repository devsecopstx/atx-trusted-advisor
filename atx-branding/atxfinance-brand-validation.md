# atxFinance Brand Validation (Institutional Pivot Dry Run)

## Scope

Dry-run validation for the institutional licensing prompt + tag system before generating new image batches.

## Tag Stack Used

```text
brand:atxFinance brand:poweredByXai entity:grokStrategyEngine entity:xstrategyBuilder
style:premiumFintech style:darkFirst style:lowNoise style:cleanGeometry style:institutionalControlPlane
layout:mobileFirst layout:centerSafe70 layout:consoleFocalPanel
trust:legibleAtMobile trust:believableFinancialUi trust:noHypeClaims trust:institutionalProcurementReady
block:gibberishText block:misspelledBranding block:misleadingFinancialValues block:retailMemeAesthetic
```

## Sample Prompt Set

### Sample 1 - Licensing Hero (4:5)

```text
Create a premium vertical 4:5 fintech hero for atxFinance with subtitle "Powered by xAI".
Show a center-right strategy console mockup with believable dark-mode UI: options builder, Greeks heatmap, backtest timeline, Grok strategy assist panel.
Keep left licensing model cards minimal and readable. Use charcoal base with restrained gain-green/lightning accents. No gibberish text.
```

### Sample 2 - Landing Hero (16:9)

```text
Create a 16:9 landing hero for atxFinance with left-side copy space and right-side strategy console.
Include "Powered by xAI", Grok, and xStrategyBuilder labels in a clean low-noise composition.
Prioritize readability and trust, avoid exaggerated PnL claims, and keep compliance/audit cues visible.
```

### Sample 3 - Enterprise Console Screenshot

```text
Create enterprise-console screenshot scene for atxFinance dark mode.
Show realistic options interface hierarchy with Grok strategy assistant and compliance audit card.
Use clean typography and balanced spacing, ensure all labels are legible on mobile.
```

## QA Checklist Result

- [x] Identity lock includes atxFinance, Powered by xAI, Grok, xStrategyBuilder
- [x] Prompts enforce legibility constraints
- [x] Prompts block misleading financial content
- [x] Composition remains mobile-safe and procurement-ready
- [x] Palette constraints avoid over-saturated neon output

## Scorecard (Prompt-Level)

- Brand Accuracy: 5/5
- Legibility Guardrails: 4.8/5
- Composition Clarity: 4.7/5
- Visual Craft Guidance: 4.6/5
- Fintech Credibility: 4.9/5
- Tag Compliance: 5/5
- Average: 4.8/5

## Ship Decision

Ship with edits.

## Quick Fix Plan

1. Add one latency-oriented variant focused on sub-100ms API telemetry motifs.
2. Add one white-label variant showing logo swap regions and theme overrides.
3. Use this prompt set for the next image batch and run `atxfinance-brand` review on outputs.
