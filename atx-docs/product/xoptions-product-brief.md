# xOptions — product brief

**Platform:** xFinance · **Surface:** xOptions · **Route:** `/xoptions`

---

## Hook

Move from **holdings to defined-risk structures** in one desk — stepped builder, HNWI review reports, wheel screener, and quant tail-risk with one-click handoff back to **xChat**.

**Subline:** *xAI-Powered Options Intelligence for Serious Portfolios*

---

## Who it is for

- Operators who already track books on **xFinance (portfolios)** and want **broker-style research UX** without leaving the workspace
- HNWI and IA desks running **covered calls, CSPs, spreads, wheel**, and income overlays on concentrated names
- Users who need **explainable** chain + review copy before any execution path (preview-only place order today)

---

## Jobs to be done

1. **Find a structure** — symbol → outlook/risk → strategy card → contract on a live chain (Yahoo-backed).
2. **Review like a desk** — step 5 HNWI report: order summary, executive note, key metrics, portfolio risk snapshot, trade thesis.
3. **Screen wheel scenarios** — capital, delta, yield filters → comparable ideas + PDF/share ([xWheel Studio](../design-system/xoptions/product-ux-spec.md) § xWheel).
4. **Stress tail risk** — Quant Trader Monte Carlo (VaR/CVaR, drawdown gate, Greeks heatmap) with export and xChat handoff.
5. **Save and collaborate** — watchlist add, scenario file to team collection (Premium+), **Ask xChat** with review text prefilled.

---

## Differentiation

| vs point solution | xOptions on xFinance |
| ----------------- | -------------------- |
| Standalone chain tools | Same **portfolio · account** context as xChat and portfolios |
| Generic options calculators | Scoring weights from workspace **Preferences**; engine-backed scanners (scheduled jobs) |
| Chat-only strike picking | **Four-step gated flow** + formal review ticket before narrative advice |

**Supported strategies (catalog):** covered calls, cash-secured puts, bull/put spreads, wheel, LEAP overlays, iron condor, calendar/diagonal, and more — index: [options-coreskills.md](../rag-collection/options-strategy-core/options-coreskills.md).

---

## Shipped capabilities (outcomes)

### Strategy builder (`/xoptions`)

Four unlocked steps:

1. **Input symbol** — workspace portfolio/account + scoring preferences  
2. **Choose outlook** — session overrides vs book defaults  
3. **Choose strategy** — single-leg (calls, covered calls, CSP) and multi-leg (buy write, call spread, put spread)  
4. **Choose contract** — expiration chips, chain with ATM/ITM, Vol/OI heatmap, Greeks (mobile toggle)  
5. **Review order** — HNWI report + portfolio impact (`GET /api/app-user/xoptions/review`)

Actions: add to watchlist, open full chain, **Ask xChat**, save scenario.

### xWheel Studio (`/xoptions/wheel`)

Multi-scenario wheel ideas with **income per cycle**, **cycle yield % of capital**, and **annualized yield**; shareable read-only report links.

### Quant Trader (`/xoptions/quant-trader`, `?tab=quant`)

Monte Carlo tail-risk panel; save as strategy job; apply to xChat **quant-trader** persona.

### Strategy jobs (optional panel)

Hardcore async jobs via Spring orchestrator — toggle in left rail under xOptions.

---

## How it connects

- **xFinance (portfolios):** holdings and hot watchlist bootstrap find-options context  
- **xChat:** prefilled prompts, scan CTAs per row, quant-trader persona handoff  
- **Watchlist:** add contract with desk metadata from step 4  
- **Scheduled automation:** `options_scanner`, `watchlist_price_scanner` (tenant tasks) — see [scanners-phase3-plan.md](../design-system/scheduled-task/scanners-phase3-plan.md)

Legacy name **xStrategyBuilder** redirects to **`/xoptions`** — use **xOptions** in all new copy.

---

## Access & plans

- Research and chain tools available; **options-approved** notice is informational per account (`optionsTradingEnabled` / env defaults)
- **xOptions views / hr** and related caps on `/account/billing` — tenant overrides via `workspaceLimits`
- Shipped tiers: `src/lib/atx-billing-plans.ts` (Premium highlights multi-account + xOptions/xChat caps)

---

## Compliance

- Review and quant surfaces: *Not investment advice. Simulations are model-based estimates.*
- **Place order** in review step is **preview-only** — no live broker order POST in core app today
- IBKR-linked verification called out as **(roadmap)** on Premium+ billing card

---

## Roadmap (honest)

| Theme | Track |
| ----- | ----- |
| Monte Carlo tail-risk engine depth | [PLAN.md § Monte Carlo](../PLAN.md#monte-carlo-tail-risk) **708** |
| Engine × xAI conversational recommendations | [PLAN.md § Engine × xAI](../PLAN.md#engine-xai-conversational-layer) |
| Crypto / exotic venues | [PLAN.md](../PLAN.md) product backlog |
| Live execution / IBKR orders | [ibkr-automation.md](../design-system/ibkr-automation.md) |

---

## Deep dives (engineering)

- [product-ux-spec.md](../design-system/xoptions/product-ux-spec.md) — UX, APIs, chain columns  
- [strategy-engine.md](../design-system/xoptions/strategy-engine.md) — scoring pipeline  
- [ui-primitives-and-patterns.md](../design-system/ui-primitives-and-patterns.md) § xOptions  
- [current-state-features.md](../design-system/current-state-features.md) § Options stack
