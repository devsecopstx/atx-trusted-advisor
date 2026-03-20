# atxFinance Mobile Brand and Marketing Kit

## Brand Positioning

- **Core promise:** AI-powered institutional options alpha with premium UX and clear decision support.
- **Tone:** trustworthy, performance-focused, and procurement-ready.
- **Tagline lockup:** `atxFinance` + `Powered by xAI`.
- **Ecosystem naming:** `Grok` for AI strategy surfaces, `xStrategyBuilder` for strategy generation and risk analytics.

## Visual Direction

- **Aesthetic:** clean Grok-like minimal fintech, dark-first, geometric, low-noise.
- **UI style:** monochrome surfaces, subtle depth, thin borders, no saturated icon colors.
- **Motifs:** simple token glyphs, node-link structures, restrained chart overlays.
- **Mockup framing:** strategy-console-led composition with supporting licensing/compliance cards.

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
- Place **Grok** and **xStrategyBuilder** glass cards on the left.
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

## Branding Update Plan (Based on Provided Example)

1. **Phase 1 - Core UI baseline**
   - Replace emoji or colorful iconography with monochrome SVG icons in primary admin cards.
   - Convert CTA and card accents to neutral grayscale while keeping contrast AA-compliant.
2. **Phase 2 - Shared token migration**
   - Keep existing CSS token names for backward compatibility, but map accent tokens to neutral values.
   - Remove neon-heavy gradients and replace with subtle white/gray depth cues.
3. **Phase 3 - Asset alignment**
   - Rebuild hero and social mocks to mirror the example's minimal composition: single focal mark, sparse background, compact copy blocks.
   - Standardize icon stroke style (single-weight outline icons) across app screenshots and marketing cards.
4. **Phase 4 - QA gate before merge**
   - Apply the `atxfinance-brand` checklist and block release for any legibility or brand naming errors.
   - Verify mobile crop safety (4:5), text readability, and consistency across `atxFinance`, `Grok`, and `xStrategyBuilder`.

## Ready-to-Use Files

- Stylesheet tokens/components: `design-system/atxfinance-brand-kit.css`
- Editable hero scene template: `design-system/atxfinance-hero-template.html`

## Prompt Template for Image Generation

Use this with image models when creating social creatives:

```text
Create a premium mobile fintech marketing hero image for atxFinance powered by xAI, Grok, and xStrategyBuilder.

Style: modern, sleek, futuristic fintech aesthetic; professional yet approachable; clean lines; dark mode UI; subtle monochrome depth.
Palette: deep charcoal/black base with silver-gray and soft white accents.
Composition: vertical 4:5 social-ready hero.
- Top: prominent atxFinance logo with small subtitle "Powered by xAI".
- Right/center: realistic strategy console mockup showing dark-mode options UI (strategy builder, Greeks panel, backtesting timeline, AI assistant panel).
- Left: floating glassmorphism cards with:
  - "Grok" AI assistant card/icon
  - xStrategyBuilder licensing card with risk/compliance symbols
  - crypto/AI motifs (token glyphs, node-link graphics, abstract neural lines) in monochrome
Visual quality: crisp, high-detail, premium product render, balanced layout, minimal clutter.
Mood: high-tech finance brand, trustworthy and innovative.
Constraints: no gibberish text, no misspellings, interface text must be legible and believable, and no saturated icon colors.
```
