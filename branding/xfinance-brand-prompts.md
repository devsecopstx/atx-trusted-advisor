# xFinance Brand Prompts (2026 Refresh)

## Purpose

This prompt set recreates xFinance marketing assets with a premium, low-noise fintech style that stays legible on mobile and consistent with `xFinance`, `Powered by xAI`, `Grok`, and `xMoney`.

## Core Prompt (Primary)

```text
Create a premium vertical 4:5 fintech hero for xFinance.

Brand lockup:
- Primary mark: "xFinance"
- Subtitle: "Powered by xAI"
- Product entities in scene: "Grok" and "xMoney"

Visual direction:
- Dark-first, modern fintech interface
- Monochrome-forward base with controlled cyan and violet accents
- Thin borders, subtle glow, glass depth, no visual clutter
- Professional and trustworthy mood with strong conversion intent

Composition:
- Top area: xFinance lockup with clean whitespace
- Center-right: realistic smartphone mockup showing believable finance UI:
  - portfolio snapshot
  - performance chart
  - Grok assistant card
  - xMoney transfer/payment activity card
- Left area: supporting floating cards and restrained AI/crypto motifs
- Preserve clear hierarchy for mobile readability

Constraints:
- No gibberish text
- No misspellings
- No misleading financial claims or impossible values
- No overbloom neon effects
- Keep all labels legible at mobile size
```

## Variants

### Variant A - Enterprise Trust

```text
Use the core prompt with these overrides:
- Increase whitespace by 20%
- Reduce glow intensity and background effects
- Emphasize governance, stability, and clarity
- Keep all metrics conservative and realistic
```

### Variant B - Growth Momentum

```text
Use the core prompt with these overrides:
- Slightly stronger chart movement and momentum cues
- Highlight onboarding speed and action-focused CTA framing
- Keep palette restrained (do not increase saturation globally)
- Preserve clean typography and spacing
```

### Variant C - AI First

```text
Use the core prompt with these overrides:
- Promote Grok assistant surface as the primary support card
- Keep finance context obvious (portfolio + payment rails always visible)
- Use subtle node-link motif to imply AI reasoning
- Ensure xMoney is still present and legible
```

## Asset-Specific Prompts

### Social Hero (4:5)

```text
Generate a 4:5 social hero for xFinance with a center-weighted mobile-safe composition.
Keep logo and key metrics inside center 70% safe zone.
```

### Landing Hero (16:9)

```text
Generate a 16:9 website hero for xFinance with left-aligned copy space and right-aligned phone mockup.
Retain Powered by xAI lockup and Grok/xMoney feature cards.
```

### App Store Screenshot Style

```text
Generate app-store-ready screenshot scene for xFinance:
- iOS-friendly dark theme
- concise, readable headline region
- realistic in-app numbers
- no decorative clutter
```

## Negative Prompt Block

```text
gibberish text, misspellings, illegible UI labels, over-saturated neon gradients,
cartoon icons, exaggerated PnL claims, fake ticker spam, crowded composition,
unreadable tiny labels, low-contrast body text
```

## Output Contract

When using these prompts, return:

1. Primary prompt used
2. Chosen variant and why
3. Negative prompt block
4. Export recommendation:
   - social PNG at 4:5
   - compressed WEBP for web
   - high-quality JPG for paid media
