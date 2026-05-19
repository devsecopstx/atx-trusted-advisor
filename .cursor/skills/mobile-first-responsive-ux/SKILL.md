---
name: mobile-first-responsive-ux
description: Mobile-first responsive UI with Tailwind and touch-friendly async flows for atxFinance product surfaces. Use for adaptive layouts, onboarding, rails/sheets, and high-frequency desk UIs. Prefer fullstack-js-ts-pwa for API wiring.
---

# Mobile-first responsive UX (atxFinance)

## Purpose

Ship **touch-first** product UI that scales to desktop without a separate native shell. Align with **`--xf-*`** tokens and dark-mode-only surfaces.

## Use this skill when

- Building or refactoring app_user pages (`/xchat`, `/xoptions`, `/portfolio`, `/watchlist`)
- Workspace rail, bottom sheets, or full-screen mobile chat layouts
- Touch targets, safe areas, and scroll containers on small viewports
- Async UX (streaming xChat, job polling, SWR loading states)

## Prefer instead

| Need | Skill |
|------|--------|
| API routes + forms + SWR | `fullstack-js-ts-pwa` |
| xChat streaming / tools / personas | `xfinance-chat-expert` rule + `skill-xchat-validation-checklist` |
| Brand tokens / wordmark | `design-branding` + `xfinance-branding.mdc` |

## Defaults (this repo)

- **Stack:** Next.js App Router, Tailwind, design tokens from `atx-docs/design-system/atxfinance-brand-kit.css`
- **Theme & patterns:** `src/lib/xf-ui-theme.ts` (soft vs deep) + `atx-docs/design-system/ui-primitives-and-patterns.md` (workspace rail, xChat/xOptions surfaces)
- **Charts:** Apex on xOptions — see `atx-docs/design-system/charts-apex.md`
- **No hardcoded hex** in app CSS

## Mobile-first workflow

1. Design for **320–390px** width first (single column, full-width CTAs).
2. Minimum **44px** touch targets on primary actions.
3. Use workspace **sheet** patterns where desktop uses side panels (watchlist quote panel, xOptions steps).
4. Add `sm:` / `md:` / `lg:` only after base layout works on mobile.
5. Test async paths: slow 3G, empty states, error retry, optimistic UI rollback.

## xChat / desk patterns

- Thread + composer: avoid nested scroll traps; one primary scroll region.
- Token meter / usage banner: readable at narrow widths (`XchatUsageMeter`).
- Guest vs signed-in: respect `surface-policy` and plans landing without duplicate nav.

## Output

- Responsive component or layout diff using `--xf-*` tokens
- Note which breakpoints were added and why
- List manual smoke URLs (e.g. `/xchat`, `/xoptions`) for narrow viewport
