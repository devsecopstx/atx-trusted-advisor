---
  Full-stack feature + branding — Next.js App Router, `src/app/**`, design tokens, API routes and server actions when needed for UI correctness, Mongo-backed flows.
name: branding
model: inherit
description: |Full-stack feature + branding — Next.js App Router
is_background: true
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
- **Icon-only edit affordances:** use `IconEditButton` / `IconEditLink` from `src/app/ui/icon-edit-control.tsx` with a clear `label` (drives `aria-label` and the theme-safe hover bubble via `XfHoverHint`). Pick `variant`: `neutral` (default square control), `primary-cta`, `secondary-cta`, `tiny` (admin row actions), or `watchlist-toolbar`. Do not show a visible “Edit” word next to the pencil unless the surface is a full text CTA (e.g. “Manage default account”).
- **Hover hints (soft + deep shells):** prefer `XfHoverHint` (`src/app/ui/xf-hover-hint.tsx`) + `.xf-hover-hint__bubble` in `globals.css` for product chrome where native `title` is unreadable or clipped (xChat rail `overflow`, header icons, beta composer controls). Keep copy short; use `aria-label` / `aria-describedby` for full semantics where needed.
- **Native `<select>` (option pickers):** global styles live in `src/app/globals.css` — `var(--xf-bg-900)` field + `var(--xf-text-100)` text, `color-scheme: dark`, matching xAI-style dropdowns. Exception: `.xsb-builder-preview--friendly` keeps light selects in `xstrategybuilder.css`. Do not reintroduce low-contrast gray-on-gray selects without an explicit product exception.
- **Top nav layout:** Wordmark / tagline (“watermark”) **flush left**; product icon row + **avatar / account menu** on the right (`xchat-header-brand` + `xchat-header-main`) — **no Hub wrench** and **no billing icon** in the header row. **Product nav** (`AppUserProductNav`): xChat, **xOptions** (legacy xStrategyBuilder PNG: `xstrategybuilder-topnav-icon-transparent.png`), Portfolio → `/portfolios`, Watchlist. Billing: **`/account/billing`** via Account menu or rail; `AppUserApprovedHeader` uses `current={null}` on billing. **`/xstrategybuilder`** redirects to **`/xoptions`** (`next.config.ts`).
- **Shell appearance:** `src/lib/xf-ui-theme.ts` + `XfThemePreferenceMenu` / `useXfShellTheme` in `src/app/ui/public-theme-picker.tsx`. **Light** / **Dark** / **System** live inside the **account menu** (avatar / guest menu icon) on xChat and Hub — no separate moon control in the header. Still **dark-first**: Light = softer charcoal (`data-xf-ui="soft"`) with **dark body text** for contrast; Dark = deep (`deep`); System = `prefers-color-scheme` → soft vs deep. Persist `localStorage` key `xf-ui-theme`; boot script in `src/app/layout.tsx` sets `html[data-xf-ui]` before paint. Optional standalone trigger: `PublicThemePicker` (legacy / tooling). **Contrast contract:** [`atx-docs/design-system/shell-theme-guidelines.md`](../../atx-docs/design-system/shell-theme-guidelines.md) — verify both shells; no faint secondary copy on light panels.
- **Account → Billing — Basic tier:** Card copy (`src/lib/atx-billing-plans.ts`) includes **workspace users**, **portfolios**, **accounts (risk & outlook)**, and **portfolio scoring factors** — not “strategy factors” at the account level; do not use a “fair use” line on that plan.
- **Account → Billing — Premium+ tier (`premium_plus_monthly`):** Card bullets include **Interactive Brokers automated trades and verification** marked **(roadmap)** until brokerage integration ships — source of truth `src/lib/atx-billing-plans.ts`.
- **Account → Billing — workspace limits block:** Below marketing bullets on each plan card; **price** appears **only** in the card header (`billing-card__price` / `billing-card__period`), not repeated in the limits list. Exactly **four** limit rows: **xOptions views / hr**, **xChat prompts / hr**, **Portfolios per user**, **Accounts per portfolio** — sourced by `src/lib/billing-plan-workspace-display.ts`. **Guests:** catalog values from `src/lib/atx-billing-plan-limits.ts` (aligned with `atx-docs/resouces/atx-limits.txt.tsv`). **Signed-in:** dynamic values from tenant `workspaceLimits` + per-tier `planOverrides` (including optional `price` USD override per `src/lib/atx-billing-plans.ts` tier id); list prices must stay aligned with `ATX_BILLING_PLANS` when overrides are unset. **Copy uses per-hour caps** for xOptions/xChat on billing (and the published limits matrix); keep in sync with product if enforcement windows change.
- **Account → Billing — feedback:** Use `BillingFeedbackLink` (`billing-feedback-link.tsx`) for in-page **Submit feedback** controls; it dispatches `USER_FEEDBACK_OPEN_EVENT` (`user-feedback-open-event.ts`) so `AppUserHeaderSession` opens the same modal as the avatar menu (page label stays `feedbackPageLabel="Billing"` on the header).
- **Portfolios (`/portfolios`):** Default signed-in landing stays **`/xchat`** (`/` → **`/xchat`**). **Product nav** icon **Portfolio** → **`/portfolios`** (`AppUserProductNav`). Rail **Portfolios** → **`/portfolios`** (`AppUserManageWorkspaceRailSection`). **Canonical URL:** **`/portfolios`** (legacy **`/workspace/portfolios`** and **`/account/workspace/portfolios`** redirect here). **Hero band (`portfolios-hero-band`):** **`lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]`** — **left ~25%** compact eyebrow + title + copy (`billing-hero` + **`portfolios-hero-band__intro`** in **`portfolios-dashboard.css`**), **right ~75%** allocation charts (`PortfoliosHeroCharts` in **`portfolios-hero-charts.tsx`**). Charts inside the hero use **`md:grid-cols-2`** for the two chart panels; hero chart type scales via **`portfolios-dashboard-charts--compact`** (**`portfolios-dashboard.css`**; **`--xf-*`** only). Below the hero: **portfolio list / create / edit / delete** only (`PortfoliosDashboardClient`). **Custodian accounts** (add, rename, default, delete) live on **`/portfolio`** and **`/portfolio/accounts/[id]`** — not duplicated on **`/portfolios`**.
- **Default portfolio (exclusive):** User may mark **exactly one** portfolio as **default** (`isDefault`); toggling default clears the prior default in the same mutation. This default drives **xChat / tools / rail “book”** resolution together with any **explicit active portfolio** selection (see next bullet).
- **Left rail — workspace before xChat:** **Your workspace** (`AppUserAccountPublicRail`) must expose a clear **portfolio** choice (name + link; extend to a **picker** if multiple portfolios). If there is **no** resolvable active portfolio for the session (e.g. no default and user has not chosen one, or product requires explicit confirmation), **block or gate xChat sends** until the user selects a portfolio from the rail (disable composer / inline prompt — do not fire **`POST /api/xchat/ask`** without a resolved portfolio context). Once chosen, persist for the session and align with **`loadAppUserDefaultBook`** / `admin_user_settings` as implemented.
- **Portfolio (`/portfolio`) — full book:** Primary surface for **positions**, **custodian accounts**, holdings, scoring, and sync. **`/portfolios`** covers **portfolio** workspace rows only (names, default, type, allocation hero charts); account CRUD stays on **`/portfolio`**.
- **Account → Legal agreements:** Signed-in **header profile menu** includes **Legal** → **`/legal/terms`** (same as footer **Terms**). The **left rail Account** section is **Settings**-only for app users; do not rely on a rail **Legal** row for approved sessions. Full Terms copy lives in **`LegalTermsContent`** (`src/app/legal/legal-default-content.tsx`): aTx Trusted Advisory, Texas / Travis County venue, $1,000 liability cap, AI + third-party disclaimers — have counsel review before material external commitments.
- **Resources (left rail · Resources disclosure):** **`/resources/about`** — aTx Trusted Advisory positioning (Austin HNW families + advisors; consolidated dashboard, reporting, collaboration). **`/resources/decision-workflow`** — platform **decisioning workflow** (Discover → Manage & Refine cards). Nav labels: **About** vs **Decision Workflow**; keep both links in `AppUserResourcesRailSection` (`app-user-rail-nav.tsx`). **`WorkspaceProductSidebar`**: same **Resources** accordion nests **User Collections** (uploads) plus guides / broker import / **Tasks** (`/account/tasks`).
- **Product left rail:** xChat (`xchat-conversation.tsx`) **loads with the left rail collapsed** (user expands via **`RailSidebarZapIcon`** yellow lightning toggle). After expand: **Manage workspace** (`AppUserManageWorkspaceRailSection`, same zap glyph on the disclosure) — workspace links + pickers when context exists, and a nested **Default book** disclosure (**collapsed** by default) showing default portfolio/account labels when provided; then **Persona** (hint via `aria-describedby`), **Active persona** + **Status**, then **Examples**, **Recent chats**, **Options** (`AppUserOptionsRailSection` → **`/xoptions`**), **Resources**, and **Account** (**Settings** only in rail; **Plans & billing** / **Legal** live in the **header profile menu**). Disclosures after Persona start **collapsed** on first land where `defaultOpen={false}`. Thread panel defaults **collapsed** when messages exist, but **stays expanded while the assistant is `loading`**. **`AppUserAccountPublicRail`** / **`AppUserAccountPublicRailForSession`**: **Manage workspace** + product sections + **Account** (settings row); **Plans & billing** remains in header on those shells too. Do not surface a **whitelabel** product subline on public chrome (footer, marketing, headers).
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
