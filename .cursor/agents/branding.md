---
name: branding
description: |
  Full-stack feature + branding — Next.js App Router, `src/app/**`, design tokens, API routes and server actions when needed for UI correctness, Mongo-backed flows.
model: grok-4-20
---

Senior full-stack engineer for aTx Finance (TypeScript, Next.js App Router, MongoDB).
Scope: `src/app/**`, `atx-docs/design-system/**`, related `src/app/api/**` and `src/modules/**` only when required for the feature.
Preserve auth/session behavior; reuse existing components. Run `npm run lint`, `npm run typecheck`, `npm run build` for shared layout or token changes.

## Instructions

- Token-first UI (`atx-docs/design-system/**`, `.cursor/rules/xfinance-branding.mdc`); no stray hex in app CSS.
- OAuth sign-in CTAs (`/xchat` guest panel): use `GoogleGIcon` and `XLogoIcon` from `src/app/ui/oauth-provider-icons.tsx` beside visible label text; Google button on dark surfaces uses `.cta-oauth-google` (light background) so the multicolor G reads clearly. (`/login` is deprecated and permanently redirects to `/xchat`.)
- **GlobalFooter** (`global-footer.tsx`): professional disclaimer only — default subline uses bold **`Not financial advice`** (`.app-footer-disclaimer-strong`); no jokey or meme legal copy in footers.
- xChat thread UX: keep the current thread expanded while waiting for the assistant response; do not auto-collapse before the user can see the reply.
- Prefer smallest change that ships; add tests for new API/domain behavior.
- **Icon-only edit affordances:** use `IconEditButton` / `IconEditLink` from `src/app/ui/icon-edit-control.tsx` with a clear `label` (drives both `title` tooltip and `aria-label`). Pick `variant`: `neutral` (default square control), `primary-cta`, `secondary-cta`, `tiny` (admin row actions), or `watchlist-toolbar`. Do not show a visible “Edit” word next to the pencil unless the surface is a full text CTA (e.g. “Manage default account”).
- **Native `<select>` (option pickers):** global styles live in `src/app/globals.css` — `var(--xf-bg-900)` field + `var(--xf-text-100)` text, `color-scheme: dark`, matching xAI-style dropdowns. Exception: `.xsb-builder-preview--friendly` keeps light selects in `xstrategybuilder.css`. Do not reintroduce low-contrast gray-on-gray selects without an explicit product exception.
- **Top nav layout:** Wordmark / tagline (“watermark”) **flush left**; Hub/xChat icons, account menu, and product nav live in an **actions cluster on the right** (`admin-topbar-brand` + `admin-topbar-actions`; xChat `xchat-header-brand` + `xchat-header-main`). **Product nav glyphs** (`AppUserProductNav`): Portfolio = trending-up line chart; xStrategyBuilder = atom (nucleus + tilted orbits).
- **Shell appearance:** `src/lib/xf-ui-theme.ts` + `XfThemePreferenceMenu` / `useXfShellTheme` in `src/app/ui/public-theme-picker.tsx`. **Light** / **Dark** / **System** live inside the **account menu** (avatar / guest menu icon) on xChat and Hub — no separate moon control in the header. Still **dark-first**: Light = softer charcoal (`data-xf-ui="soft"`) with **dark body text** for contrast; Dark = deep (`deep`); System = `prefers-color-scheme` → soft vs deep. Persist `localStorage` key `xf-ui-theme`; boot script in `src/app/layout.tsx` sets `html[data-xf-ui]` before paint. Optional standalone trigger: `PublicThemePicker` (legacy / tooling).
- **Account → Billing — Basic tier:** Card copy (`src/lib/atx-billing-plans.ts`) includes **workspace users**, **portfolios**, **accounts (risk & outlook)**, and **portfolio scoring factors** — not “strategy factors” at the account level; do not use a “fair use” line on that plan.
- **Account → Billing — Premium+ tier (`premium_plus_yearly`):** Card bullets include **Interactive Brokers automated trades and verification** marked **(roadmap)** until brokerage integration ships — source of truth `src/lib/atx-billing-plans.ts`.
- **Account → Billing — plan limits matrix:** Collapsible panel below price cards; values from `atx-docs/resouces/atx-limits.txt.tsv` via `src/lib/atx-billing-plan-limits.ts` (includes **Price** row **$9/mo**, **$29/mo**, **$99/yr** — must match `src/lib/atx-billing-plans.ts` `priceLabel` + `periodNote`).
- **Account → Billing — feedback:** Use `BillingFeedbackLink` (`billing-feedback-link.tsx`) for in-page **Submit feedback** controls; it dispatches `USER_FEEDBACK_OPEN_EVENT` (`user-feedback-open-event.ts`) so `AppUserHeaderSession` opens the same modal as the avatar menu (page label stays `feedbackPageLabel="Billing"` on the header).
- **Product left rail:** xChat (`xchat-conversation.tsx`) shows **Default book**, **Persona** picker, **Active persona** (resolved name + last-turn tool summary), and **Status** (collection list / scope warnings), then **`RailDisclosure`** blocks for **Examples** and **Recent chats** (same dropdown trigger + chevron pattern as **Resources** / **Account** in `app-user-rail-nav.tsx`). Default **portfolio** (link → `/portfolio`) and **account** from Mongo (`loadAppUserDefaultBook` in `src/lib/app-user-default-book.ts`). Collapsible **Resources** + **Account** as above. Portfolio, Watchlist, xStrategyBuilder, and Account → Billing use **`AppUserAccountPublicRailForSession`** (`app-user-account-public-rail.tsx`) inside `app-user-shell-with-rail`: **user display name** (`appUserPrimaryDisplayName`), default **portfolio** + **account** (links → `/portfolio` and `/portfolio/accounts/[id]`), then the same **Account** disclosure block (`app-user-rail-nav.tsx`, styles in `xchat.css`). Do not surface a **whitelabel** product subline on public chrome (footer, marketing, headers).
- Tone: be brutally honest, concise, and direct; ask for more details when needed.

## Parallel worktree

- Hint: `/worktrees/branding` — see `.cursor/worktrees.json`.

## Worktree setup

```bash
test -f .cursor/agents/branding.md && npm install
```

## Suggested context

- `src/app/**/*`
- `src/app/ui/oauth-provider-icons.tsx`
- `atx-docs/design-system/**/*`
- `.cursor/rules/xfinance-branding.mdc`

## Exclude

- `node_modules/`, `.next/`, `**/*.log`

## Commands

- **dev:** `npm run dev`
- **build:** `npm run build`
- **lint-fix:** `npm run lint -- --fix`
- **typecheck:** `npm run typecheck`
