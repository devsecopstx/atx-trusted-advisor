# xFinance Branding Review — Latest Style Changes

Review against `**.cursor/rules/xfinance-branding.mdc**` (expert pass).

**Logo lockup (current):** **aTx⚡Finance** — **aTx** (gain-green) + **⚡** (lightning yellow, `--xf-lightning-yellow`) + **Finance** (white), implemented in `src/app/ui/atxfinance-logo.tsx`. This supersedes older review text that suggested removing "aTx" from the mark.

**Product decision:** Keep the current **AtxFinanceLogo** + **MarketingHero** for the landing. Do **not** add a separate full-page hero with inline ⚡ + "xF" + "xFinance Coach" + custom CTAs; that treatment was reverted and is not desired.

**Investor / GTM / waitlist:** Differentiation, channel targets, MVP priority (xChat + portfolio first), compliance narrative, and roadmap tiered pricing live in `**.cursor/rules/xfinance-branding.mdc`** — summarized for **xChat** and **xOptions** in [`product/xchat-product-brief.md`](../product/xchat-product-brief.md) and [`product/xoptions-product-brief.md`](../product/xoptions-product-brief.md). Mirror **shipped** billing/plans UI for any dollar amounts; waitlist/deck may reference roadmap tiers as secondary copy.

---

## 1. Logo wordmark vs “aTx” (updated)

**Current rule:** Wordmark is **aTx⚡Finance** (bolt between **aTx** and **Finance**). See `xfinance-branding.mdc` and `atxfinance-logo.tsx`.

**A11y / copy:** Prefer **"xFinance"** in `aria-label` and screen-reader strings where a short product name is enough; avoid awkward spellings like "aTX" unless testing a specific string.

**Standalone hero icon:** Where a full lockup is not used (e.g. large marketing or deck slides), **⚡ + stylized "xF"** remains valid per the rule — distinct from the in-app **aTx⚡Finance** lockup.

---

## 2. Marketing hero & guests (`MarketingHero`)

The **home** experience uses `**MarketingHero`** + shared chrome — not the reverted full-page alternate hero. When editing `MarketingHero` or guest-visible landing:


| Item              | Rule                                                           | Note                                                      |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------- |
| Background / dark | `#050505`, dark-only                                           | Use `--xf-*` / tokens per brand kit where possible        |
| Lockup            | **aTx⚡Finance** in `**AtxFinanceLogo`**                        | Bolt between aTx and Finance                              |
| Tagline           | "No Atoms Moved. Just Gains Earned."                           | ✅                                                         |
| Subline           | "xAI-Powered Options Intelligence for Serious Portfolios" (optional secondary on access/plans) | Align with `xfinance-branding.mdc` when hero is refreshed |
| Accent green      | Rule `#22c55e` vs `--xf-gain-green`                            | See §3                                                    |
| Product hierarchy | xFinance, xChat, xCoach, xMoney                                | Footer / descriptor                                       |
| CTAs              | Real `<Link>` targets                                          | `/xchat`, plans, etc.                                     |


**Waitlist / one-slide landings (future):** Follow `**xfinance-branding.mdc`** — differentiation + product stack + secondary roadmap copy; no fake metrics or testimonials.

---

## 3. Design system vs rule green

- **Rule / marketing:** Accent green `**#22c55e`** (neon gains) in prose maps to **`--xf-green-500`** in product CSS.
- **Design system:** `--xf-gain-green: #39ff14` (`atx-docs/design-system/atxfinance-brand-kit.css`) — wordmark / tagline / nav only.
- **Authoritative green usage table:** [`atxfinance-brand-kit.css`](../design-system/atxfinance-brand-kit.css) (comment after `:root`) · [DEVELOPMENT.md § Branding Tokens](../../DEVELOPMENT.md#branding-tokens) — scanner pass (`--xf-green-500`), IV/heat (`--xf-green-400`), wheel cards (`--xf-accent-cta` / emerald-500), Step 4 CTA borders (`border-green-500`).

**Resolution:** App surfaces use the **semantic green table** + `--xf-*`; marketing hero may still use `emerald-400` / `#22c55e` per rule where no product token applies. Document any new surface in the same PR if both greens appear side-by-side.

---

## 4. Gaps & follow-ups (non-blocking)


| Topic             | Gap                                                   | Where to track                                     |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Hero refresh      | Subline, billing/plans alignment, CTA links if drift   | This doc + PR                                      |
| Green tokens      | Authoritative table in brand kit + DEVELOPMENT.md      | [`atxfinance-brand-kit.css`](../design-system/atxfinance-brand-kit.css) · [DEVELOPMENT.md § Branding Tokens](../../DEVELOPMENT.md#branding-tokens) |
| Waitlist page     | Not in core app yet — copy lives in rule + product briefs until routed | `xfinance-branding.mdc` · [`../product/`](../product/) · [`../PLAN.md`](../PLAN.md) if needed |
| Credential upload | Rule = roadmap only; don’t ship fake FINRA/SEC UI     | `xfinance-branding.mdc`                            |


---

## 5. Legal pages (Privacy, Terms)

- **Routes:** `/legal/imprint`, `/legal/security`, `/legal/vulnerability`, `/legal/privacy` (**Privacy Policy**), and `/legal/terms` (**Terms of Service**) render default copy from `src/app/legal/legal-default-content.tsx` (effective date and release-safe sections; counsel review still required before regulated use).
- **Footer:** `GlobalFooter` links include **Terms** and **Privacy** alongside Imprint, Security, and vulnerability reporting.
- **Operator note:** Treat defaults as a starting point — have counsel review entity name, governing law, contact channels, and regulated-industry obligations before relying on them in production.

---

## 6. Global footer & compliance chrome

- `**GlobalFooter**` (`src/app/ui/global-footer.tsx`): legal nav (Imprint, Terms, Privacy, Security, Report a vulnerability), copyright **atx Trusted Advisor**, `**APP_VERSION_LABEL`** from `package.json` via `src/lib/app-version.ts` (no separate product subline after the © name).
- **Subline (product surfaces only):** Pass `subline` from layouts that need a disclaimer — e.g. `**xchat/layout.tsx`** and `**xstrategybuilder/layout.tsx**` use **Not financial advice** + provider credit. `**admin/layout.tsx`** uses `<GlobalFooter />` without a subline.
- **Tone:** Footer and disclaimers stay **professional and compliance-oriented** — no ironic, meme, or jokey legal copy in production chrome (see `**xdesign-review`** visual + trust gate).

---

## 7. Summary

- **Logo:** Primary lockup remains **aTx** mark + ⚡ + **Trusted Advisor** in `**AtxFinanceLogo**` / `**XchatHeaderBrand**` (see §8).
- **Docs sync:** When `**xfinance-branding.mdc`** changes materially, update this file and follow `**generate-docs**` + `**test-commit-push**`.
- **Optional:** Align accent green story across hero vs admin (§3) if stakeholders ask.

---

## 8. User chrome (March 2026) — **atx Trusted Advisor**

- **Constants:** `**src/app/ui/product-brand-constants.ts**` — `USER_PRODUCT_HOME_ARIA_LABEL`, `USER_PRODUCT_DESCRIPTOR_LINE` for marketing (no whitelabel subline constant on public chrome).
- **xChat header:** `**XchatHeaderBrand**` — **Trusted / Advisory** wordmark plus inline gains tagline (see component).
- **xChat left rail (signed-in):** **Persona** picker, then **Active persona** (name + last-turn tool summary), then **Status** (collection list / scope messages) — not duplicated in the main column. Persona now uses the same disclosure pattern as **Examples** and **Recent chats** for consistent rail behavior.
- **App user header / guest xChat:** Home link uses `USER_PRODUCT_HOME_ARIA_LABEL`.
- **Footer:** `**GlobalFooter**` — © line **atx Trusted Advisor** in `**app-footer-brand-stack**`.
- **Marketing / plans / portfolio / xOptions:** User-facing chrome uses **atx Trusted Advisor** where a legal descriptor is needed; product nav labels remain **xChat**, **xOptions**, **xFinance** (portfolios) per [`product/README.md`](../product/README.md).
- **Legal stubs:** `**legal-default-content.tsx**` uses `PRODUCT_PUBLIC_NAME = "atx Trusted Advisor"` for the web app; entity line may still read **aTx⚡Finance** where appropriate.
- **Backend persona name:** Default published app-role persona is **atx-trusted-advisor** (admin default remains **Super-Agent**).

---

## 9. Public CTA marketing screenshots (May 2026 — v2)

**Path:** `public/marketing-screenshots/` — served at **`/marketing-screenshots/<filename>`** (Next `public/` static). Use for waitlist, FinTwit/X, LinkedIn, email digest, and hero refreshes. **Do not** invent live metrics or testimonials beyond what the captures show. Pair with tagline **"No Atoms Moved. Just Gains Earned."** and subline from `xfinance-branding.mdc`.

**Index (v2 refresh — scanner tightening + xOptions/xChat proof):**

| Filename | Surface / story | X post | Website hero | LinkedIn carousel | Email digest |
| -------- | ---------------- | :----: | :------------: | :---------------: | :----------: |
| `01-portfolios.png` | `/portfolios` desk — multi-book totals, watchlist IV/OI rail, movers | | **Primary** | Slide 1 — portfolio stack | Header / weekly book summary |
| `01-covered-call.png` | xChat — wheel vs CC vs PMCC compare on top holdings (Heavy / Grok 4.3) | **Primary** | Alt hero — advisory | Slide 2 — xChat depth | Strategy compare callout |
| `01-weekly-recap-dark-1200x630.png` | xChat weekly recap — what worked / didn't / next week (IV >45% scanner) | **Primary** (1200×630) | OG / social card | Slide 5 — recap | **Primary** — digest hero |
| `02-scanner-iv45-hits.png` | xChat IV Rank Scanner (>45%) table + watchlist context | **Primary** | Alt hero — scanner | Slide 3 — scanner tightening | Scanner hits section |
| `02-scanner-iv45-hits-1920x1080.png` | Same as above — **1920×1080** for deck / LinkedIn document | | Deck hero | **Primary** (16:9) | Full-width banner |
| `02-wheel-studio-input.png` | Wheel Strategy Idea Generator inputs (HNWI report builder) | | Landing — wheel story | Slide 4 — defined-risk wheel | Wheel studio CTA block |
| `02-xoptions-step1.png` | xOptions step 1 — symbol input (RDW), holdings + hot list | | Step flow intro | Carousel slide 1/5 | — |
| `02-xoptions-step2.png` | xOptions — choose contract, put chain, premium summary | | — | Carousel slide 4/5 | — |
| `02-xoptions-step3.png` | xOptions step 3 — choose strategy (cash-secured put selected) | | — | Carousel slide 3/5 | — |
| `02-xoptions-step4.png` | xOptions step 3 variant — strategy cards + skyline (same step, wider crop) | | — | Alt carousel crop | — |
| `03-xchat-step1.png` | xChat — wheel strategy narrative + ASCII payoff diagram | **Primary** | — | xChat advisory slide | — |
| `03-xchat-option-scan.png` | xChat Options Action Scan card — close candidates + watchlist | **Primary** | — | Scanner + desk slide | Action scan recap |
| `03-choose-contract-greeks.png` | xOptions step 4 + Quant Trader sidebar (VaR/CVaR, POP) | | Quant / pro hero | Slide — quant trader | — |
| `04-new-defined-risk-wheel-card-1920x1080.png` | Wheel ideas compare — income, yield, assignment/call-away chart | | **Primary** (16:9) | **Primary** — wheel outcomes | Wheel idea spotlight |
| `05-xoptions-step4-payoff-preview-1200x630.png` | xOptions review order — CSP RDW, advisor note, POP/yield (1200×630) | **Primary** (1200×630) | OG — execution preview | Final slide — review | Trade idea card |
| `06-portfolio-context-greeks-overlay-1920x1080.png` | Portfolio holdings grid — IV rank, Greeks, broker-style marks | | Desk hero | Holdings + Greeks slide | Holdings table teaser |

**Ops:** Prefer **`01-weekly-recap-dark-1200x630.png`** and **`05-xoptions-step4-payoff-preview-1200x630.png`** for Open Graph / X cards (1200×630). Prefer **`*-1920x1080.png`** for LinkedIn document posts and deck exports. **Exclude** scratch captures (e.g. `SCR-*.png`) from external CTAs until renamed and re-reviewed.

**Cross-refs:** [`design-system/current-state-features.md`](../design-system/current-state-features.md) § UX performance · [`branding/README.md`](../branding/README.md) · [`PLAN.md`](../PLAN.md) § GTM.

