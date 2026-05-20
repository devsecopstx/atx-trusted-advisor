# xFinance — product & GTM briefs

Canonical **marketing and business** descriptions for the **xFinance** platform and its primary app surfaces. Use these for investor one-slides, waitlist copy, partner intros, and internal alignment — not for API contracts or implementation specs.

**Naming (standard):**

| Layer | Name | Route(s) |
| ----- | ---- | -------- |
| **Platform** | **xFinance** | Workspace shell, billing, access |
| **Surface — advisory** | **xChat** | `/xchat` |
| **Surface — options desk** | **xOptions** | `/xoptions` (legacy `/xstrategybuilder` redirects here) |
| **Surface — portfolios** | **xFinance** (portfolios) | `/portfolios`, `/portfolio`, `/portfolio/accounts/[id]` |
| **Wordmark / hero** | **aTx⚡Finance** | Marketing lockup per [brand kit](../design-system/atxfinance-brand-kit.md) |
| **Legal / descriptor** | **atx Trusted Advisor** | Footers, Terms — see [xfinance-branding-review.md](../xchat/xfinance-branding-review.md) §8 |

**Tagline:** *No Atoms Moved. Just Gains Earned.*  
**Subline:** *Options Profits Powered by Grok*

---

## Briefs

| Doc | Audience | Purpose |
| --- | -------- | ------- |
| **[xchat-product-brief.md](./xchat-product-brief.md)** | Investors, IA/HNWI prospects, GTM | Grok advisory chat grounded in the user's book |
| **[xoptions-product-brief.md](./xoptions-product-brief.md)** | Same | Stepped options research, review reports, wheel & quant desks |

**Platform GTM (one-slide):** `.cursor/rules/xfinance-branding.mdc` — tagline, differentiation, waitlist channels, compliance narrative.

---

## Related docs (not duplicated here)

| Topic | Where |
| ----- | ----- |
| Technical architecture & shipped APIs | [current-state-features.md](../design-system/current-state-features.md) |
| xChat implementation | [xchat/](../xchat/) (tools, BFF, prompts, debug) |
| xOptions UX & API spec | [design-system/xoptions/product-ux-spec.md](../design-system/xoptions/product-ux-spec.md) |
| Options scoring engine | [design-system/xoptions/strategy-engine.md](../design-system/xoptions/strategy-engine.md) |
| Brand visuals & hero rules | [branding/](../branding/), `.cursor/rules/xfinance-branding.mdc` |
| Backlog | [PLAN.md](../PLAN.md) |
| Billing tiers (shipped UI) | `/account/billing`, `src/lib/atx-billing-plans.ts` |
