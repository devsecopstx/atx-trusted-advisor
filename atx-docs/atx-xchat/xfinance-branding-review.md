# xFinance Branding Review — Latest Style Changes

Review against `**.cursor/rules/xfinance-branding.mdc**` (expert pass).

**Logo lockup (current):** **aTx⚡Finance** — **aTx** (gain-green) + **⚡** (lightning yellow, `--xf-lightning-yellow`) + **Finance** (white), implemented in `src/app/ui/atxfinance-logo.tsx`. This supersedes older review text that suggested removing "aTx" from the mark.

**Product decision:** Keep the current **AtxFinanceLogo** + **MarketingHero** for the landing. Do **not** add a separate full-page hero with inline ⚡ + "xF" + "xFinance Coach" + custom CTAs; that treatment was reverted and is not desired.

**Investor / GTM / waitlist:** Differentiation, channel targets, MVP priority (xChat + portfolio first), compliance narrative, and roadmap tiered pricing live in `**.cursor/rules/xfinance-branding.mdc`** — keep **$2/hr** as the canonical hero number in product UI; waitlist/deck may reference roadmap tiers as secondary copy.

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
| Subline           | "Cheapest xFinance at $2/hr • Options Profits Powered by Grok" | Keep subline when hero is refreshed                       |
| $2/hr             | emerald-400 + tooltip                                          | Add `title` / `aria-describedby` on $2/hr and primary CTA |
| Accent green      | Rule `#22c55e` vs `--xf-gain-green`                            | See §3                                                    |
| Product hierarchy | xFinance, xChat, xCoach, xMoney                                | Footer / descriptor                                       |
| CTAs              | Real `<Link>` targets                                          | `/xchat`, plans, etc.                                     |


**Waitlist / one-slide landings (future):** Follow `**xfinance-branding.mdc`** — differentiation + $2/hr + secondary roadmap copy; no fake metrics or testimonials.

---

## 3. Design system vs rule green

- **Rule / marketing:** Accent green `**#22c55e`** (neon gains) in prose.
- **Design system:** `--xf-gain-green: #39ff14` (`design-system/atxfinance-brand-kit.css`).

**Resolution:** App surfaces and charts use `**--xf-*`**; marketing hero may use `emerald-400` / `#22c55e` per rule. Document any new surface in the same PR if both greens appear side-by-side.

---

## 4. Gaps & follow-ups (non-blocking)


| Topic             | Gap                                                   | Where to track                                     |
| ----------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Hero refresh      | Subline, $2/hr tooltip, CTA links if drift            | This doc + PR                                      |
| Green tokens      | Single table “where which green” if confusion returns | Brand kit or `DEVELOPMENT.md`                      |
| Waitlist page     | Not in core app yet — copy lives in rule until routed | `xfinance-branding.mdc` + [`../PLAN.md`](../PLAN.md) if needed |
| Credential upload | Rule = roadmap only; don’t ship fake FINRA/SEC UI     | `xfinance-branding.mdc`                            |


---

## 5. Legal pages (Privacy, Terms)

- **Routes:** `/legal/imprint`, `/legal/security`, `/legal/vulnerability`, `/legal/privacy` (**Privacy Policy**), and `/legal/terms` (**Terms of Service**) render default copy from `src/app/legal/legal-default-content.tsx` (effective date and release-safe sections; counsel review still required before regulated use).
- **Footer:** `GlobalFooter` links include **Terms** and **Privacy** alongside Imprint, Security, and vulnerability reporting.
- **Operator note:** Treat defaults as a starting point — have counsel review entity name, governing law, contact channels, and regulated-industry obligations before relying on them in production.

---

## 6. Global footer & compliance chrome

- `**GlobalFooter**` (`src/app/ui/global-footer.tsx`): legal nav (Imprint, Terms, Privacy, Security, Report a vulnerability), copyright **atx Trusted Advisor** + **whitelabel** subline, `**APP_VERSION_LABEL`** from `package.json` via `src/lib/app-version.ts`.
- **Subline (product surfaces only):** Pass `subline` from layouts that need a disclaimer — e.g. `**xchat/layout.tsx`** and `**xstrategybuilder/layout.tsx**` use **Not financial advice** + provider credit. `**admin/layout.tsx`** uses `<GlobalFooter />` without a subline.
- **Tone:** Footer and disclaimers stay **professional and compliance-oriented** — no ironic, meme, or jokey legal copy in production chrome (see `**xdesign-review`** visual + trust gate).

---

## 7. Summary

- **Logo:** Primary lockup remains **aTx** mark + ⚡ + **Trusted Advisor** in `**AtxFinanceLogo**` / `**XchatHeaderBrand**` (see §8).
- **Docs sync:** When `**xfinance-branding.mdc`** changes materially, update this file and follow `**generate-docs**` + `**test-commit-push**`.
- **Optional:** Align accent green story across hero vs admin (§3) if stakeholders ask.

---

## 8. User chrome (March 2026) — **atx Trusted Advisor** + **whitelabel**

- **Constants:** `**src/app/ui/product-brand-constants.ts**` — `USER_PRODUCT_HOME_ARIA_LABEL`, `USER_PRODUCT_WHITELABEL_SUBLINE` (`whitelabel`), `USER_PRODUCT_DESCRIPTOR_LINE` for marketing.
- **xChat header:** `**XchatHeaderBrand**` — same **Trusted / Advisor** wordmark as the full logo, with a **whitelabel** subline (`**.xf-whitelabel-sub**`, tiny muted grey).
- **App user header / guest xChat:** Home link uses `USER_PRODUCT_HOME_ARIA_LABEL` (includes “whitelabel” for screen readers).
- **Footer:** `**GlobalFooter**` — © line **atx Trusted Advisor** + **whitelabel** in `**app-footer-whitelabel**` / `**app-footer-brand-stack**`.
- **Marketing / plans / portfolio / xStrategyBuilder:** User-facing copy uses **atx Trusted Advisor** where the old product string **xFinance** appeared.
- **Legal stubs:** `**legal-default-content.tsx**` uses `PRODUCT_PUBLIC_NAME = "atx Trusted Advisor"` for the web app; entity line may still read **aTx⚡Finance** where appropriate.
- **Backend persona name:** Default published persona display name **xFinance** (FinExpert slug) is unchanged — only marketing/chrome copy moved to **atx Trusted Advisor**.

