# xFinance Branding Tags (2026 Refresh)

## Intent

Use this tag system to generate consistent xFinance visuals across social, web, product marketing, and store assets.

## Required Identity Tags

- `brand:xFinance`
- `brand:poweredByXai`
- `entity:grokAssistant`
- `entity:xmoneyRails`

All four tags are mandatory in any hero or campaign prompt.

## Style Tags

- `style:premiumFintech`
- `style:darkFirst`
- `style:lowNoise`
- `style:glassDepthSubtle`
- `style:cleanGeometry`

## Composition Tags

- `layout:mobileFirst`
- `layout:centerSafe70`
- `layout:focalPhoneMockup`
- `layout:supportCardsLeft`
- `layout:balancedWhitespace`

## Trust and Credibility Tags

- `trust:legibleAtMobile`
- `trust:believableFinancialUi`
- `trust:noHypeClaims`
- `trust:governedTone`
- `trust:conversionReady`

## Color and Motion Tags

- `color:charcoalBase`
- `color:neutralSurfaceRamp`
- `color:cyanAccentControlled`
- `color:violetAccentControlled`
- `motion:restrainedGlow`

## Content Tags

- `content:portfolioSnapshot`
- `content:performanceChart`
- `content:aiAssistantPanel`
- `content:paymentActivityCard`
- `content:securityConfidenceCue`

## Platform Tags

- `platform:social4x5`
- `platform:landing16x9`
- `platform:appStoreScreenshot`
- `platform:darkModeUi`
- `platform:adminConsole`

## Anti-Pattern Tags (Blocklist)

- `block:gibberishText`
- `block:misspelledBranding`
- `block:overcrowdedComposition`
- `block:aggressiveNeonBloom`
- `block:misleadingFinancialValues`

## Quick Tag Presets

### Preset: Social Hero

```text
brand:xFinance brand:poweredByXai entity:grokAssistant entity:xmoneyRails
style:premiumFintech style:darkFirst style:lowNoise
layout:mobileFirst layout:centerSafe70 layout:focalPhoneMockup
trust:legibleAtMobile trust:believableFinancialUi
platform:social4x5
block:gibberishText block:misspelledBranding
```

### Preset: Landing Hero

```text
brand:xFinance brand:poweredByXai entity:grokAssistant entity:xmoneyRails
style:premiumFintech style:cleanGeometry
layout:balancedWhitespace layout:focalPhoneMockup
trust:conversionReady trust:governedTone
platform:landing16x9
block:overcrowdedComposition block:aggressiveNeonBloom
```

### Preset: App Store

```text
brand:xFinance entity:grokAssistant entity:xmoneyRails
style:darkFirst style:lowNoise
layout:mobileFirst layout:centerSafe70
trust:legibleAtMobile trust:believableFinancialUi
platform:appStoreScreenshot platform:darkModeUi
block:gibberishText block:misleadingFinancialValues
```

### Preset: Admin Console Clean (console.x.ai inspired)

```text
brand:xFinance brand:poweredByXai
style:darkFirst style:lowNoise style:cleanGeometry
layout:balancedWhitespace layout:mobileFirst
trust:legibleAtMobile trust:governedTone trust:conversionReady
platform:adminConsole platform:darkModeUi
block:overcrowdedComposition block:aggressiveNeonBloom
```

## Admin Console UX Traits

Apply these traits for admin/operator surfaces:

- Sparse information hierarchy with strong section titles and subdued helper text
- High-contrast tables with soft separators and minimal chrome
- Compact, predictable control placements (filters/actions near table context)
- Neutral backgrounds with restrained accent usage for status and CTA only
- Interaction density optimized for operations without visual noise
