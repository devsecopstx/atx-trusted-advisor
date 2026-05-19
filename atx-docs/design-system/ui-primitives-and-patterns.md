# UI Primitives & Patterns

**Status:** Proposed (May 2026)  
**Owner:** Design + Frontend  
**Related:** `atxfinance-brand-kit.css`, `shell-theme-guidelines.md`, `.cursor/rules/xfinance-branding.mdc`, `globals.css`, `atx-docs/design-system/atxfinance-brand-kit.md`

This document captures the recurring UI building blocks and conventions used across the xFinance product surfaces (xChat, xOptions, Portfolios, Admin). It is intended to reduce drift and give reviewers + Cursor agents a single place to check patterns.

## How to Use This Document

- **PR authors & reviewers**: Reference the relevant section (especially theming, workspace rail, xChat, or xOptions) when making UI changes. Link it in the PR description.
- **Cursor agents**: Treat this as required reading alongside `shell-theme-guidelines.md` and `.cursor/rules/xfinance-branding.mdc`.
- **Adding new patterns**: When a pattern appears in 2+ surfaces, document it here with clear "When to use" / "Do not" guidance and update the reviewer checklist.
- **Cross-links**: Update this doc whenever new primitives (e.g. new rail behavior, composer patterns) stabilize in code.

## 1. Theming & Shells

- **Two shells supported:**
  - `deep` (default dark, high contrast)
  - `soft` (light charcoal, `html[data-xf-ui="soft"]`)
- User preference is managed in `src/lib/xf-ui-theme.ts` and persisted.
- **Never** hardcode background or text colors for themeable surfaces. Use `--xf-bg-*`, `--xf-surface-*`, `--xf-text-*` tokens.
- Soft shell overrides live in `src/app/globals.css`.
- **Contrast rule (blocker):** Text must remain sharply readable in both shells. See `shell-theme-guidelines.md` for the full checklist.

**When to reference this doc in PRs:** Any change to layout chrome, sidebars, cards, or theme-sensitive components.

## 2. Workspace Rail & Product Sidebar (2026+)

The left rail used on authenticated product pages (`/xchat`, `/xoptions`, `/portfolios`, etc.) is implemented via `WorkspaceProductSidebar` + `AppUserProductNav`.

**Conventions:**
- Use Lucide icons (currentColor) for product glyphs.
- Active state uses `--xf-gain-green` or tenant accent.
- The rail is **not** a traditional sidebar nav — it is a workspace context switcher.
- On narrow viewports it collapses; behavior is defined in the layout components.

**Do not:**
- Add new top-level product entries without updating both the rail and the product header.
- Hardcode product names — they come from `surface-policy.ts` + config.

## 3. Starfield Background

Used on the main product surfaces for depth.

- Implemented as a full-bleed fixed layer (`z-index: -20`).
- Theme-aware base fill + subtle grid + low-density node constellation (CSS-only animation, respects `prefers-reduced-motion`).
- Austin skyline asset is anchored at the bottom band (`/branding/atx-skyline-*.png`).

**Pattern:** Import `StarfieldBackground` or apply the `.bg-skyline-*` classes only where the full treatment is desired.

## 4. Cards & Surfaces

- Primary elevated surface: `--xf-surface-700`
- Interactive / raised: `--xf-surface-600`
- Use `--xf-radius-sm` (12px), `--xf-radius-md` (18px), `--xf-radius-lg` (28px)
- Shadows: `--xf-shadow-soft`, `--xf-shadow-card`
- Glass effect (where used): `--xf-blur-glass`

**xOptions specific:**
- `--xf-xoptions-surface`
- `--xf-xoptions-accent` (violet)

## 5. Data & Chart Patterns

- Gains: `--xf-gain-green` (#39ff14) + glow `var(--xf-gain-glow)`
- Losses: `--xf-chart-loss`
- Charts: Prefer ApexCharts. Use resolved RGB values via `resolveDesignTokenColor` when the library requires it.
- Two accent greens exist by design:
  - Product/charts: `--xf-gain-green`
  - Marketing hero: `emerald-400` / `#22c55e` (allowed per branding review)

## 6. Forms, Composer, & Density

- xChat composer uses `--xf-chat-font-size`, `--xf-chat-line-height`, `--xf-chat-padding-*`
- Usage meter: `--xf-meter-*` tokens
- Keep input density consistent with the rail and main content column.

## 7. xChat Specific Patterns

### Composer & Input Area
- Use the shared composer rail (`XchatComposerRailRouting`) for persona model, Depth preset (Fast / Expert / Heavy), last-turn execution info, and RAG summary.
- Depth toggle (`XchatReasoningModeToggle`) is persisted in `localStorage` (`xf_xchat_reasoning_mode`) and sent as `reasoningMode`.
- Input area follows `--xf-chat-font-size`, `--xf-chat-line-height`, and padding tokens.
- “Ask xChat” handoff from other surfaces (xOptions, portfolio alerts, etc.) prefills the composer via `sessionStorage` key `xf_xchat_pending_prompt_v1`.

### Templates Gallery & Workspace Library
- Templates strip uses pill scroller + “See all” grid.
- Each template card triggers `resolveWheelCcScanComposerPrompt` (or equivalent) for desk-report style prompts.
- Workspace pulse / library badge reuses `xchat-workspace-bar__pulse` styles.
- Saved user prompts (`xchat_user_prompt_templates`) are limited (max ~40 per user) and deletable via bookmark UI.

### Persona Menu
- Replaces native select with Grok-style rows (`xchat-persona-menu`).
- Shows `previewLine` derived from `systemPrompt`.
- “Auto” selection falls back to the tenant’s default published persona.

### Styling Notes
- All new xChat UI lives in `src/app/xchat/xchat.css`.
- Soft theme overrides are explicitly scoped under `html[data-xf-ui="soft"]`.
- Workspace rail integration must match the glyph sizing used by `WorkspaceProductSidebar`.

**When editing:** Update both the templates UI doc (`xchat-hnwi-templates-ui.md`) and this section.

## 8. xOptions Specific Patterns

### Overall Layout & Flow
- Gated 4-step progressive disclosure (Symbol → Outlook → Strategy → Contract).
- Horizontal stepper + vertical sections unlock sequentially.
- Workspace row at top of step 1 shows **Portfolio · Account** + collapsed **Preferences** panel (scoring weight overrides).
- Symbol + “At a glance” (holdings + hot watchlist) share a row on wide screens.

### Chain Table & Selection
- Moneyness treatment: ATM pill + ITM green tint (calls below spot, puts above), OTM neutral.
- Vol / OI columns use a visible-row heatmap.
- Bid (strong green) / Ask (softer) / Mid / BE / IV%.
- On narrow viewports (< 1024px): “Show Greeks / Hide Greeks” toggle.
- Selected row: light fill + `--xf-xoptions-accent` (#8b5cf6) left border.
- Column layouts (Default / Greeks / Liquidity / Advanced) are user-persisted in `localStorage`.

### Review & Output
- Review order ticket card includes max credit/debit, P(OTM) stats, assignment/obligation block, and potential earnings highlight.
- “Add to watchlist” from chain adds rich metadata (lineType, strategy, entryPrice, riskProfile, outlook).
- “Ask xChat” copies review text and opens xChat with prefilled prompt.
- Payoff visualization uses the patterns defined in `options-payoff-chart-spec.md`.

### Shell Theme & Rail
- Soft shell remaps `--xf-xoptions-surface` to the softened `--xf-bg-900`.
- Layout imports both `xchat.css` and `portfolios-dashboard.css` so `WorkspaceProductSidebar` Lucide glyphs are sized consistently (`portfolios-workspace-sidebar__glyph`).
- Apex charts in the symbol panel switch light/dark grid automatically with the shell.

### Wheel Studio
- Separate flow (`/xoptions/wheel`) with per-scenario economics (income/cycle, yield, annualized).
- Reports can be shared via time-limited token + optional PDF.

**When editing:** Keep `xchat/xoptions-strategy-builder.md` as the detailed UX spec and sync high-level patterns here.

## 9. Common Anti-Patterns (Blockers for Review)

- Hardcoded `#090909`, `#111214`, `white`, `black/10`, raw `rgba` for themeable surfaces.
- Using `--xf-text-300` or `--xf-text-400` as primary body text on soft shell.
- New product surface that ignores `data-xf-ui` or the workspace rail pattern.
- Adding a new top-level nav item without updating `surface-policy.ts` and both rail + header components.

## 10. Review Checklist (for atxdesign-review + reviewer agent)

- [ ] Both shells tested (or `dark:` utilities verified)
- [ ] No hardcoded theme colors on new surfaces
- [ ] Workspace rail / product nav updated if surface changed
- [ ] Tokens from brand kit used instead of ad-hoc values
- [ ] Starfield / skyline treatment applied consistently (when appropriate)
- [ ] Contrast passes the rules in `shell-theme-guidelines.md`

## Public / Guest Marketing Patterns (2026)

The main guest landing (`/`) and lightweight pages (`/for-developers`, `/growth`) follow the deep/dark marketing aesthetic only (no soft shell). 

Key conventions:
- Hero always starts with the stylized tagline chip ("No Atoms Moved — Just Gains Earned.") + `aTx⚡Finance` lockup where space allows.
- "How it works" is a 3-step outcome block immediately after the hero (Connect → Chat grounded in your book → Execute with guardrails).
- Primary CTA on landing is always the green "Start Basic Trial — No Card".
- Secondary actions (Sign In with X, See plans, IA pilot) live below or in the final access block only.
- Product proof (screenshots, pillars) comes *after* the 3-step, never before.
- Lightweight pages reuse the same slim header + 3-step pattern + outcome copy. They do **not** become internal wikis.

See `src/app/ui/public-marketing-landing.tsx` and the two new pages for current implementation. Update this section when the pattern evolves.

## 11. Future Additions (TBD)

- Empty / error / loading state patterns
- Table + virtualized list conventions (TanStack Virtual usage)
- Modal + drawer density rules
- Tenant accent color derivation and safe usage
- Animation / motion guidelines (Framer Motion defaults)

---

**How to evolve this doc:** When a new recurring pattern appears in 2+ surfaces, add it here with a short "When to use / Do not" section and link from the relevant component or layout file. Update the reviewer agent prompt when this document changes.