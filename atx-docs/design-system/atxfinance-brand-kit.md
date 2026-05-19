# xFinance Design System & Brand Kit

**Source of truth** for visual identity, tokens, and product + marketing guidelines. For active Cursor/agent rules, see `.cursor/rules/xfinance-branding.mdc`.

## Current Brand Positioning (2026)

- **Core promise:** Institutional-grade defined-risk options income tools + Grok-powered advisory at retail price with minimal daily screen time.
- **Primary tagline:** **"No Atoms Moved. Just Gains Earned."**
- **Secondary:** **"Options Profits Powered by Grok"**
- **Tone:** Professional, calm, benefit-first. Never hype.
- **Ecosystem naming:** `xFinance` (core workspace), `xChat` (Grok advisor), `xOptions` (strategy builder + scanner), `xCoach` (exam readiness). `xMoney` is future.

## Theming

The product supports two first-class shells:
- **Deep (dark)** — default high-contrast experience
- **Soft (light charcoal)** — user-selectable via theme picker for daytime use

See `shell-theme-guidelines.md` for contrast rules, `data-xf-ui` implementation, and reviewer requirements. Marketing / hero materials continue to favor the deep aesthetic.

## Active Rules & Maintenance

**Primary enforcement:** `.cursor/rules/xfinance-branding.mdc` (alwaysApply). All new marketing, hero, and product copy must follow it.

**Legacy tokens:** `--xf-blue-400`, `--xf-cyan-400`, `--xf-purple-400`, and `--xf-purple-500` are marked legacy. New work should prefer semantic tokens (`--xf-gain-green`, `--xf-accent-cta`, `--xf-nav-green`, `--xf-xoptions-accent`, etc.) or direct `--xf-text-*` / `--xf-surface-*` values. A full migration pass has not been completed.

## Visual Direction (Product)

- **Aesthetic:** Clean, Grok-aligned minimal fintech. Monochrome surfaces with subtle depth.
- **UI style:** Thin borders, restrained use of `--xf-gain-green` for gains/CTAs, geometric motifs.
- **Theming:** Supports deep (dark) and soft (light charcoal) shells. Never use pure white or harsh light as primary canvas.
- **Key surfaces (2026):** xChat (with workspace rail), xOptions strategy builder, Portfolios workspace, Admin console.

See `shell-theme-guidelines.md` and `.cursor/rules/xfinance-branding.mdc` for current rules.

## Color System

### Core palette

| Token | Hex | Use |
| --- | --- | --- |
| `--xf-bg-900` | `#090909` | Primary canvas base |
| `--xf-bg-800` | `#111214` | Secondary deep background |
| `--xf-surface-700` | `#17191d` | Elevated cards |
| `--xf-surface-600` | `#1f2329` | Raised interactive surfaces |
| `--xf-text-100` | `#f6f8fc` | Primary text |
| `--xf-text-300` | `#b5bac6` | Secondary text |
| `--xf-text-400` | `#888f9f` | Tertiary / muted text |
| `--xf-blue-400` | `#d1d6de` | Neutral accent (legacy token name) |
| `--xf-cyan-400` | `#c6ccd6` | Neutral highlight (legacy token name) |
| `--xf-purple-400` | `#c7ccd5` | Neutral tertiary accent (legacy token name) |
| `--xf-purple-500` | `#b6bcc7` | Neutral gradient depth |

### Semantic colors

| Token | Hex | Use |
| --- | --- | --- |
| `--xf-success-400` | `#8bd5b3` | Success states, live badges |
| `--xf-danger-400` | `#f5a0ad` | Error states, destructive actions |
| `--xf-warning-400` | `#dfc78d` | Warning states, pending badges |
| `--xf-gain-green` | `#39ff14` | Neon green for gains, CTAs, hero accents |
| `--xf-gain-green-muted` | `#00cc00` | Subdued green for secondary gain indicators |

### Chart tokens

| Token | Hex | Use |
| --- | --- | --- |
| `--xf-chart-bar-lo` | `#aab0ba` | Chart bar gradient start |
| `--xf-chart-bar-hi` | `#d4d9e0` | Chart bar gradient end |
| `--xf-chart-gain` | `#39ff14` | Positive chart values |
| `--xf-chart-loss` | `#f5a0ad` | Negative chart values |

## Typography

- **UI stack:** `Inter`, `SF Pro Display`, `Segoe UI`, sans-serif.
- **Heading style:** tight letter spacing (`-0.01em` to `-0.03em`), bold weight (700-800).
- **Body style:** medium size and high contrast against dark surfaces.
- **Do not:** use placeholder or pseudo-language text in marketing visuals.

## Layout and Composition Rules (Hero)

- Use a **4:5 vertical** social-ready frame.
- Keep the **atxFinance logo top-left/top-center** with subtitle `Powered by xAI`.
- Place the **strategy console mockup center-right** as the primary focal object.
- Place **Grok** and **xOptions** glass cards on the left.
- Keep negative space around logo and key UI metrics; avoid overpacking.

## Admin Console Direction (console.x.ai inspired)

Use this direction for operator/admin surfaces where fast scanning matters more than visual flair:

- **Structure:** section title + short helper text + context actions + table/list body.
- **Density:** compact controls and row spacing, but never below readable thresholds.
- **Controls:** place search/filter/actions adjacent to the data they affect.
- **Palette:** neutral dark surfaces with restrained accents for status and focus only.
- **Hierarchy:** emphasize headings and column labels; de-emphasize secondary metadata.
- **Interaction:** keep affordances clear (`Export`, `Invite users`, row menus) and consistent.
- **Do not:** add decorative glow or high-saturation accents on data-dense admin screens.

## Historical: Early Branding Refresh Plan (2026)

This section documents an earlier phase of the brand evolution. Current direction is captured in:
- `.cursor/rules/xfinance-branding.mdc`
- `atx-docs/xchat/xfinance-branding-review.md`
- `shell-theme-guidelines.md`

Many of the Phase 1–3 items (monochrome icons, token discipline, hero minimalism) have been adopted. The plan is retained here for historical context only.

## Ready-to-Use Files & References

- **Tokens:** `atx-docs/design-system/atxfinance-brand-kit.css` (imported in `src/app/layout.tsx`)
- **Hero template:** `atx-docs/design-system/atxfinance-hero-template.html`
- **Active branding rules:** `.cursor/rules/xfinance-branding.mdc`
- **Shell theming:** `shell-theme-guidelines.md`
- **UI primitives & patterns (required for product surfaces):** `ui-primitives-and-patterns.md`
- **Latest branding review:** `xchat/xfinance-branding-review.md`

## Prompt Template for Image Generation

Use this with image models when creating social creatives:

```text
Create a premium mobile fintech marketing hero image for xFinance powered by xAI, Grok, and xOptions.

Style: modern, sleek, futuristic fintech aesthetic; professional yet approachable; clean lines; dark mode UI; subtle monochrome depth.
Palette: deep charcoal/black base with silver-gray and soft white accents.
Composition: vertical 4:5 social-ready hero.
- Top: prominent atxFinance logo with small subtitle "Powered by xAI".
- Right/center: realistic strategy console mockup showing dark-mode options UI (strategy builder, Greeks panel, backtesting timeline, AI assistant panel).
- Left: floating glassmorphism cards with:
  - "Grok" AI assistant card/icon
  - xOptions licensing card with risk/compliance symbols
  - fintech / AI motifs (subtle glyphs, node-link graphics, abstract neural lines) in monochrome
Visual quality: crisp, high-detail, premium product render, balanced layout, minimal clutter.
Mood: high-tech finance brand, trustworthy and innovative.
Constraints: no gibberish text, no misspellings, interface text must be legible and believable, and no saturated icon colors.
```
