# xFinance Mobile Brand and Marketing Kit

## Brand Positioning

- **Core promise:** AI-native personal finance with premium UX and clear decision support.
- **Tone:** trustworthy, forward-looking, and approachable.
- **Tagline lockup:** `xFinance` + `Powered by xAI`.
- **Ecosystem naming:** `Grok` for AI assistant surfaces, `xMoney` for payment rails and transfer actions.

## Visual Direction

- **Aesthetic:** clean Grok-like minimal fintech, dark-first, geometric, low-noise.
- **UI style:** monochrome surfaces, subtle depth, thin borders, no saturated icon colors.
- **Motifs:** simple token glyphs, node-link structures, restrained chart overlays.
- **Mockup framing:** smartphone-led composition with supporting floating feature cards.

## Color System

| Token | Hex | Use |
| --- | --- | --- |
| `--xf-bg-900` | `#090909` | Primary canvas base |
| `--xf-bg-800` | `#111214` | Secondary deep background |
| `--xf-surface-700` | `#17191D` | Elevated cards |
| `--xf-text-100` | `#F7FBFF` | Primary text |
| `--xf-text-300` | `#B5BAC6` | Secondary text |
| `--xf-blue-400` | `#D1D6DE` | Neutral accent (legacy token name) |
| `--xf-cyan-400` | `#C6CCD6` | Neutral highlight (legacy token name) |
| `--xf-purple-400` | `#C7CCD5` | Neutral tertiary accent (legacy token name) |
| `--xf-purple-500` | `#B6BCC7` | Neutral gradient depth |

## Typography

- **UI stack:** `Inter`, `SF Pro Display`, `Segoe UI`, sans-serif.
- **Heading style:** tight letter spacing (`-0.01em` to `-0.03em`), bold weight (700-800).
- **Body style:** medium size and high contrast against dark surfaces.
- **Do not:** use placeholder or pseudo-language text in marketing visuals.

## Layout and Composition Rules (Hero)

- Use a **4:5 vertical** social-ready frame.
- Keep the **xFinance logo top-left/top-center** with subtitle `Powered by xAI`.
- Place the **phone mockup center-right** as the primary focal object.
- Place **Grok** and **xMoney** glass cards on the left.
- Keep negative space around logo and key UI metrics; avoid overpacking.

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
   - Apply the `xfinance-brand` checklist and block release for any legibility or brand naming errors.
   - Verify mobile crop safety (4:5), text readability, and consistency across `xFinance`, `Grok`, and `xMoney`.

## Ready-to-Use Files

- Stylesheet tokens/components: `design-system/xfinance-brand-kit.css`
- Editable hero scene template: `design-system/xfinance-hero-template.html`

## Prompt Template for Image Generation

Use this with image models when creating social creatives:

```text
Create a premium mobile fintech marketing hero image for xFinance powered by xAI, Grok, and xMoney.

Style: modern, sleek, futuristic fintech aesthetic; professional yet approachable; clean lines; dark mode UI; subtle monochrome depth.
Palette: deep charcoal/black base with silver-gray and soft white accents.
Composition: vertical 4:5 social-ready hero.
- Top: prominent xFinance logo with small subtitle "Powered by xAI".
- Right/center: realistic smartphone mockup showing dark-mode finance app UI (optimus coach, exam, finance charts, AI assistant panel).
- Left: floating glassmorphism cards with:
  - "Grok" AI assistant card/icon
  - xMoney payment card with transfer/payment symbols
  - crypto/AI motifs (token glyphs, node-link graphics, abstract neural lines) in monochrome
Visual quality: crisp, high-detail, premium product render, balanced layout, minimal clutter.
Mood: high-tech finance brand, trustworthy and innovative.
Constraints: no gibberish text, no misspellings, interface text must be legible and believable, and no saturated icon colors.
```
