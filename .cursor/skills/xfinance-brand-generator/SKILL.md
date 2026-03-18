---
id: xfinance-brand-generator
name: xfinance-brand-generator
description: Generates premium xFinance brand asset prompts and creative variants for mobile fintech marketing. Use when creating hero images, social creatives, app-store visuals, or campaign art featuring xAI, Grok, and xMoney.
---

# xFinance Brand Generator

## Goal

Generate production-grade prompts and creative directions for xFinance visuals that are legible, premium, and consistent with the brand system.

## Use This Skill When

- User asks to create marketing images, brand heroes, launch visuals, ad creatives, or app-store mockups.
- Work must include xFinance with xAI, Grok, and/or xMoney.
- Need fast prompt variants tuned for conversion and mobile readability.
- User asks for asset specs, app icon/splash requirements, or store-submission visual prep (iOS/Android).

## Brand Defaults (Always Apply)

- **Style:** modern, sleek, futuristic fintech; professional but approachable.
- **Palette:** deep navy/black base with electric blue, cyan, ultraviolet-purple accents.
- **UI direction:** dark mode, clean lines, subtle glow, no visual clutter.
- **Composition default:** vertical `4:5` social-ready with strong focal hierarchy.
- **Text quality:** no gibberish, no misspellings, all labels legible and believable.

## Mobile Asset Requirements (2025-2026)

Assume cross-platform delivery (React Native + Expo, Flutter, Capacitor, or native). Use Expo/RN paths as defaults unless the user specifies another stack.

### Core Required Assets (Must Have)

| File / Folder | Typical Path (Expo / RN) | Size / Format | Platforms | Purpose / Notes |
|---|---|---|---|---|
| **App Icon (base)** | `assets/icon.png` | `1024x1024`, PNG, no transparency | iOS + Android | Master icon source for generated variants. Keep square, no rounded corners in source. |
| **Adaptive Icon foreground** | `assets/adaptive-icon-foreground.png` | `108x108 dp` (about `432x432` at 4x), PNG | Android | Foreground logo/symbol layer. Keep logo in safe zone. |
| **Adaptive Icon background** | `assets/adaptive-icon-background.png` | Same as foreground, PNG | Android | Solid color, gradient, or subtle pattern background. |
| **Splash screen image (legacy/full)** | `assets/splash.png` | `1242x2688` or larger, PNG | iOS + Android | Full-screen splash art for legacy flows or older Expo setups. |
| **Splash icon (modern)** | `assets/splash-icon.png` | `200x200` or `240x240`, PNG | iOS + Android | Center logo used by modern Expo splash pipeline. |
| **Favicon (web/PWA)** | `assets/favicon.png` | `32x32` or `64x64`, PNG | Web / PWA | Needed when web/PWA support exists. |

### Strongly Recommended Additional Assets

| Asset | Typical Path | Size(s) | Platforms | When / Why Needed |
|---|---|---|---|---|
| Notification icon | `assets/notification-icon.png` | `96x96`, white on transparent | Android | Status bar push icon should be monochrome. |
| Play Store feature graphic | Store listing asset | `1024x500`, PNG/JPG | Google Play | Major conversion lever for listing page. |
| Play Store hi-res icon | Store listing asset | `512x512`, PNG | Google Play | Required listing icon. |
| App Store screenshot set | Store listing asset | Device-specific (for example `1290x2796`) | App Store | 5-10 screenshots per locale/device family. |
| App Store promotional icon | Store listing asset | `1024x1024`, PNG | App Store | Promotional and editorial usage. |
| Dark mode variants | `assets/icon-dark.png`, `assets/splash-icon-dark.png` | Same as light variants | iOS + Android | Recommended for strong dark/light brand systems. |

## xFinance Theme Recommendations (2025-2026)

Use this as the default palette and style baseline for fintech visuals:

| Element | Recommended Choice | Hex / Example | Rationale |
|---|---|---|---|
| Primary color | Deep teal / electric cyan / vibrant indigo | `#0EA5E9` or `#6366F1` | Trust + innovation balance |
| Accent / CTA | Bright coral / electric purple | `#F472B6` or `#A78BFA` | Energy and action focus |
| Neutral background | Near-black dark mode + pure white light mode | `#0F172A` / `#FFFFFF` | Modern contrast, OLED-friendly |
| Success / profit | Emerald / teal-green | `#10B981` | Finance-positive without neon harshness |
| Danger / loss | Soft red / rose | `#EF4444` | Clear but less aggressive than pure red |
| Font family | Inter, SF Pro, Manrope, Satoshi | sans-serif | High legibility at small sizes |
| Border radius | 12-20 px cards/buttons | n/a | Softer and more approachable UI |
| Elevation / shadows | Subtle depth (0-4 px), occasional glass | n/a | Premium feel without noise |

## Pre-Submission Checklist (Stores)

- [ ] `1024x1024` source icon exists (PNG, no alpha/transparency issues).
- [ ] Adaptive icon set exists (foreground + background) for Android 8+.
- [ ] Splash icon exists and splash background/image is configured.
- [ ] Dark-mode icon/splash variants are prepared if theme differs.
- [ ] Android notification icon exists (monochrome).
- [ ] Store graphics are ready (feature graphic, hi-res icon, screenshots).

## Fast Generation Tools

- [expo-assets-generator.vercel.app](https://expo-assets-generator.vercel.app/)
- [easyappicon.com](https://easyappicon.com/)
- [nextnative.dev free tools](https://nextnative.dev/free-tools/app-icon-splash-generator)
- Figma Expo app icon/splash templates for safe-zone validation

## Prompt Build Workflow

1. Define asset objective: awareness, product feature, or conversion.
2. Pick composition: hero (phone-led), card-led, or logo-led.
3. Lock mandatory brand entities: `xFinance`, `Powered by xAI`, `Grok`, `xMoney`.
4. Specify believable UI modules (portfolio, crypto charts, AI assistant, payments).
5. Add quality constraints (legibility, balance, minimal clutter, premium render).
6. Generate one primary prompt plus 2-3 variants.

## Output Format

Return exactly this structure:

```markdown
## Primary Prompt
<single high-quality prompt>

## Variant Prompts
1. <variant focused on composition>
2. <variant focused on palette/mood>
3. <variant focused on conversion CTA framing>

## Negative Constraints
- No gibberish text
- No misspellings
- No overcrowded composition
- No unrealistic or misleading financial values
- No washed-out contrast

## Recommended Crop/Export
- Ratio: 4:5
- Safe zone: keep logo + key UI in center 70%
- Deliverables: PNG (social), WEBP (web), JPG high quality (ads)
```

## Primary Prompt Template

```text
Create a premium mobile fintech marketing hero image for xFinance powered by xAI, Grok, and xMoney.

Style: modern, sleek, futuristic fintech aesthetic; professional yet approachable; clean lines; dark mode UI; subtle neon glow.
Palette: deep navy/black base with electric blue, cyan, and ultraviolet-purple accents.
Composition: vertical 4:5 social-ready hero.
- Top: prominent xFinance logo with small subtitle "Powered by xAI".
- Right/center: realistic smartphone mockup showing dark-mode finance app UI (portfolio summary, crypto charts, Grok AI assistant panel, xMoney payment activity cards).
- Left: floating glassmorphism cards with:
  - "Grok" AI assistant card/icon
  - "xMoney" payment card with transfer/payment symbols
  - crypto/AI motifs (token glyphs, node-link graphics, abstract neural lines)
Visual quality: crisp, high-detail, premium product render, balanced layout, minimal clutter.
Mood: high-tech finance brand, trustworthy and innovative.
Constraints: no gibberish text, no misspellings, keep interface believable and legible.
```

## Fast Variant Strategy

- **V1 (Enterprise trust):** reduce glow intensity, increase whitespace, cleaner typography.
- **V2 (Growth):** stronger cyan-purple gradients, slightly more chart energy.
- **V3 (AI-first):** emphasize Grok card and AI panel while keeping financial UI credible.

## Optional Project Context

If present, align with:

- `design-system/xfinance-brand-kit.css`
- `design-system/xfinance-brand-kit.md`

If absent, follow this skill as the default generator spec.

## If User Asks for xfinance-branding

When requested, provide one or more of:

- Expo-ready `assets/` file/folder naming structure
- Suggested xFinance light/dark color tokens
- `app.json` or `app.config.ts` icon/splash/adaptive icon configuration snippets
