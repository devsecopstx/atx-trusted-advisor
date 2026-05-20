# atxFinance Brand Prompts (Institutional Pivot)

## Purpose

This prompt set recreates atxFinance marketing assets with a premium, low-noise institutional fintech style that stays legible on mobile and consistent with `atxFinance`, `Powered by xAI`, `Grok`, and **xOptions** (options desk).

## Core Prompt (Primary)

```text
Create a premium vertical 4:5 institutional fintech hero for atxFinance.

Brand lockup:
- Primary mark: "atxFinance"
- Subtitle: "Powered by xAI"
- Product entities in scene: "Grok" and "xOptions"

Visual direction:
- Dark-first, modern fintech interface
- Monochrome-forward base with controlled gain-green and lightning-yellow accents
- Thin borders, subtle glow, glass depth, no visual clutter
- Professional and trustworthy mood with procurement-ready credibility

Composition:
- Top area: atxFinance lockup with clean whitespace
- Center-right: realistic strategy console mockup showing believable options UI:
  - strategy construction panel
  - Greeks/risk heatmap
  - backtesting timeline
  - compliance/audit status card
- Left area: supporting licensing cards and restrained AI/market-data motifs
- Preserve clear hierarchy for mobile readability

Constraints:
- No gibberish text
- No misspellings
- No misleading financial claims or impossible values
- No overbloom neon effects
- No retail meme aesthetic
- Keep all labels legible at mobile size
```

## Variants

### Variant A - White-Label Licensing

```text
Use the core prompt with these overrides:
- Increase whitespace by 20%
- Reduce glow intensity and background effects
- Emphasize partner branding swap zones and governance controls
- Keep all metrics conservative and realistic
```

### Variant B - API-First Integration

```text
Use the core prompt with these overrides:
- Promote API telemetry and strategy request flow card as primary support panel
- Highlight low-latency response framing (<100ms benchmark target)
- Keep palette restrained and operational
- Preserve clean typography and spacing
```

### Variant C - Managed Hosted SaaS

```text
Use the core prompt with these overrides:
- Promote compliance dashboard and role-based controls as primary support cards
- Keep strategy/risk context obvious (builder + Greeks + audit)
- Use subtle node-link motif to imply explainable AI decisions
- Ensure enterprise hosting posture is visible and legible
```

## Asset-Specific Prompts

### Social Hero (4:5)

```text
Generate a 4:5 social hero for atxFinance with a center-weighted mobile-safe composition.
Keep logo and key metrics inside center 70% safe zone.
```

### Landing Hero (16:9)

```text
Generate a 16:9 website hero for atxFinance with left-aligned copy space and right-aligned strategy console mockup.
Retain Powered by xAI lockup and Grok/xOptions feature cards.
```

### App Store Screenshot Style

```text
Generate institutional landing screenshot scene for atxFinance:
- enterprise-ready dark theme
- concise, readable headline region
- realistic in-app numbers
- no decorative clutter
```

### Admin Console Surface (console.x.ai clean style)

```text
Generate an atxFinance admin console screen in a clean, low-noise style inspired by console.x.ai.

Requirements:
- clear section headers and concise helper copy
- table-first layout with soft separators and compact row density
- action buttons grouped near table context ("Export", "Invite", filters)
- restrained monochrome base with minimal accent usage
- legible labels for roles/permissions and status states

Constraints:
- no saturated gradients
- no decorative glow over data regions
- no dense visual clutter that impairs operator scanning
```

## Negative Prompt Block

```text
gibberish text, misspellings, illegible UI labels, over-saturated neon gradients,
cartoon icons, exaggerated PnL claims, fake ticker spam, crowded composition, retail meme aesthetic,
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
