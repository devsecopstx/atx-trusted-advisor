# atxFinance Branding Tags (Institutional Pivot)

## Intent

Use this tag system to generate consistent atxFinance visuals across enterprise decks, licensing pages, and product marketing.

## Required Identity Tags

- `brand:atxFinance`
- `brand:poweredByXai`
- `entity:grokStrategyEngine`
- `entity:xstrategyBuilder`

All four tags are mandatory in any hero, licensing, or campaign prompt.

## Style Tags

- `style:premiumFintech`
- `style:darkFirst`
- `style:lowNoise`
- `style:institutionalControlPlane`
- `style:cleanGeometry`

## Composition Tags

- `layout:mobileFirst`
- `layout:centerSafe70`
- `layout:consoleFocalPanel`
- `layout:licensingCardsLeft`
- `layout:balancedWhitespace`

## Trust and Credibility Tags

- `trust:legibleAtMobile`
- `trust:believableFinancialUi`
- `trust:noHypeClaims`
- `trust:governedTone`
- `trust:institutionalProcurementReady`

## Color and Motion Tags

- `color:charcoalBase`
- `color:neutralSurfaceRamp`
- `color:gainGreenAccentControlled`
- `color:lightningYellowHighlight`
- `motion:restrainedGlow`

## Content Tags

- `content:optionsStrategyBoard`
- `content:greeksHeatmap`
- `content:backtestPanel`
- `content:riskControlCard`
- `content:complianceAuditTrail`

## Platform Tags

- `platform:social4x5`
- `platform:landing16x9`
- `platform:investorOneSlide`
- `platform:darkModeUi`
- `platform:enterpriseConsole`

## Anti-Pattern Tags (Blocklist)

- `block:gibberishText`
- `block:misspelledBranding`
- `block:overcrowdedComposition`
- `block:aggressiveNeonBloom`
- `block:misleadingFinancialValues`
- `block:retailMemeAesthetic`

## Quick Tag Presets

### Preset: Social Hero

```text
brand:atxFinance brand:poweredByXai entity:grokStrategyEngine entity:xstrategyBuilder
style:premiumFintech style:darkFirst style:lowNoise
layout:mobileFirst layout:centerSafe70 layout:consoleFocalPanel
trust:legibleAtMobile trust:believableFinancialUi
platform:social4x5
block:gibberishText block:misspelledBranding
```

### Preset: Landing Hero

```text
brand:atxFinance brand:poweredByXai entity:grokStrategyEngine entity:xstrategyBuilder
style:premiumFintech style:cleanGeometry style:institutionalControlPlane
layout:balancedWhitespace layout:consoleFocalPanel
trust:institutionalProcurementReady trust:governedTone
platform:landing16x9 platform:investorOneSlide
block:overcrowdedComposition block:aggressiveNeonBloom block:retailMemeAesthetic
```

### Preset: App Store

```text
brand:atxFinance entity:grokStrategyEngine entity:xstrategyBuilder
style:darkFirst style:lowNoise
layout:mobileFirst layout:centerSafe70
trust:legibleAtMobile trust:believableFinancialUi
platform:investorOneSlide platform:darkModeUi
block:gibberishText block:misleadingFinancialValues
```

### Preset: Admin Console Clean (console.x.ai inspired)

```text
brand:atxFinance brand:poweredByXai entity:xstrategyBuilder
style:darkFirst style:lowNoise style:cleanGeometry style:institutionalControlPlane
layout:balancedWhitespace layout:mobileFirst
trust:legibleAtMobile trust:governedTone trust:institutionalProcurementReady
platform:enterpriseConsole platform:darkModeUi
block:overcrowdedComposition block:aggressiveNeonBloom block:retailMemeAesthetic
```

## Admin Console UX Traits

Apply these traits for admin/operator surfaces:

- Sparse information hierarchy with strong section titles and subdued helper text
- High-contrast tables with soft separators and minimal chrome
- Compact, predictable control placements (filters/actions near table context)
- Neutral backgrounds with restrained accent usage for status and CTA only
- Interaction density optimized for operations without visual noise
