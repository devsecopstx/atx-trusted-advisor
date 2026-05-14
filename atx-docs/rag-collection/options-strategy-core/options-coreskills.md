---
id: xfinance-desk-options-coreskills
name: xfinance-desk-options-coreskills
description: Canonical strategy map, risk/outlook vocabulary, and xChat output contract for the aTx options desk
strategy_type: strategy_index
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: stock
tags: [desk_reference, skill_map, output_contract, hnwi, multi_strategy]
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# atx-options — strategy reference

**aTx Finance · options education & agent context**

Short-form strategy narratives (Markdown + frontmatter) plus links to **executable** Cursor skills under `.cursor/skills/skill-*`. Use the **narrative** files for human-readable semantics; use the **SKILL** files when dispatching agents or validating playbook depth.

**Columns in the strategy map:** **Risk bucket** uses **Conservative / Balanced / Aggressive** (xFinance desk vocabulary). **Outlook** is the implied regime bias for the structure (not a prediction).

---

## Table of contents

- [Content review framework (every strategy file)](#content-review-framework-every-strategy-file)
- [How this tree is organized](#how-this-tree-is-organized)
- [Strategy map — core (lean)](#strategy-map-core-lean)
- [Strategy map — advanced (full depth)](#strategy-map-advanced-full-depth)
- [Output contract (holdings + watchlist / Wheel · CC scan)](#output-contract-holdings-watchlist-wheel-cc-scan)
- [Related indexes](#related-indexes)

---

## Content review framework (every strategy file)

Each **`options-strategy-core/*.md`** and **`options-strategy-advanced/*.md`** narrative should answer, in order:

1. **One-sentence definition** — what the structure *is*.
2. **Best market conditions** — when it tends to work / be deployed.
3. **Risk bucket** — **Conservative**, **Balanced**, or **Aggressive** (tail, leverage, assignment).
4. **Payoff profile** — max profit, max loss, breakeven(s) (per standard construction).
5. **Position sizing rules** — capital, contracts, % book / ticker caps.
6. **Worked example** — round numbers (e.g. **SPY**, **NVDA**) — **illustrative**, not live quotes.
7. **When to avoid** — regime, liquidity, policy, or tax reasons.
8. **Tax & assignment (HNWI)** — high-signal checklist only; **not tax advice**; confirm with CPA.
9. **Quick reference table** — Greeks / POP / margin at a glance.
10. **Guardrails + Output contract** — desk rules + machine JSON envelope (below).

Meta topics (**tax**, **earnings**, **sizing**, **vol rank**, **payoff templates**) use the same headings where they apply; some rows read **N/A (cross-cutting)** instead of a single payoff.

---

## How this tree is organized

| Layer | Location | Role |
|-------|----------|------|
| **Core narratives (flat)** | [`options-strategy-core/*.md`](./covered-call-and-csp.md) | Lean Finance KB slice — **default `finance-advisor` persona** disk scope. |
| **Advanced narratives (flat)** | [`../options-strategy-advanced/`](../options-strategy-advanced/bull-call-debit-spread.md) | Full playbooks — **`advisor` persona** disk scope. |
| **Response guidelines (flat)** | [`../atx-response-guidelines/`](../atx-response-guidelines/citation-format.md) | Same Finance collection on **`refresh-finance`** — structure, citations, tone, disclaimers (shared KB; not split by **`finance-advisor`** vs **`advisor`** `always_include`). |
| **Mongo catalog (nested)** | [`../options-strategy/<slug>/<slug>.md`](../options-strategy/wheel/wheel.md) | **Seed-only** `options_strategy` / admin xOptions; not uploaded by `refresh-finance`. |
| **Agent skills** | [`.cursor/skills/skill-*/SKILL.md`](../../../.cursor/skills/skill-wheel-strategy/SKILL.md) | Deep playbooks for Cursor. |
| **This index** | [`options-coreskills.md`](./options-coreskills.md) | Strategy ↔ doc ↔ **risk bucket** ↔ **outlook** ↔ `xfinance-strategy-*` ↔ skill. |

**Mongo:** `seed:admin` / `seed:options-strategy-*` sync this tree into **`options_strategy`** (and prefs). **xAI:** canonical **Finance** collection (`XAI_FINANCE_COLLECTION_ID`, default `collection_b75e188e-e7e6-4aa8-8e01-23caf0946236`) — sync via **`npm run seed:finance-xai-collection`** or **Admin → Personas → Sync Finance Collection to xAI**; do not duplicate full narrative MD into Mongo **`xchat_rag_chunks`**. **Doc entry:** [`atx-docs/README.md`](../../../README.md) § *Options (RAG + seed)*.

---

## Strategy map — core (lean)

| Strategy | Narrative doc | Risk bucket | Outlook | `xfinance-strategy-*` id | Cursor skill |
|----------|----------------|-------------|---------|---------------------------|----------------|
| **Covered call + CSP** | [covered-call-and-csp.md](./covered-call-and-csp.md) | Balanced | Neutral–bullish / willing to own lower | `xfinance-strategy-covered-call-csp` | [`skill-covered-calls`](../../../.cursor/skills/skill-covered-calls/SKILL.md) · [`skill-cash-secured-puts`](../../../.cursor/skills/skill-cash-secured-puts/SKILL.md) |
| **Wheel** | [wheel-strategy.md](./wheel-strategy.md) | Balanced (→Aggressive if oversized) | Bullish CSP→CC cycle | `xfinance-strategy-wheel` | [`skill-wheel-strategy`](../../../.cursor/skills/skill-wheel-strategy/SKILL.md) |
| **Iron condor + jade lizard (overview)** | [iron-condor-jade-lizard.md](./iron-condor-jade-lizard.md) | Balanced | Range / skewed premium | `xfinance-strategy-iron-condor-jade-lizard` | [`skill-iron-condor`](../../../.cursor/skills/skill-iron-condor/SKILL.md) · [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Cross-cutting sizing** | [position-sizing-and-risk-management.md](./position-sizing-and-risk-management.md) | — | — | *(meta)* | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Earnings playbook** | [earnings-playbook.md](./earnings-playbook.md) | — | Event / vol | *(meta)* | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Vol / IV rank** | [volatility-rank-and-iv-crush.md](./volatility-rank-and-iv-crush.md) | — | Regime filter | *(meta)* | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Straddle / strangle** | [straddle-strangle.md](./straddle-strangle.md) | Aggressive (long) / Balanced (income variants) | Vol / direction | `xfinance-strategy-straddle-strangle` | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Payoff templates** | [payoff-templates-and-examples.md](./payoff-templates-and-examples.md) | — | — | *(meta)* | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Tax & assignment** | [options-tax-considerations.md](./options-tax-considerations.md) | — | HNWI checklist | *(meta)* | — |

---

## Strategy map — advanced (full depth)

| Strategy | Narrative doc | Risk bucket | Outlook | `xfinance-strategy-*` id | Cursor skill |
|----------|----------------|-------------|---------|---------------------------|----------------|
| **Bull call debit spread** | [bull-call-debit-spread.md](../options-strategy-advanced/bull-call-debit-spread.md) | Balanced | Bullish | `xfinance-strategy-bull-call-debit-spread` | [`skill-bull-call-debit-spread`](../../../.cursor/skills/skill-bull-call-debit-spread/SKILL.md) |
| **Bull put credit spread** | [bull-put-credit-spread.md](../options-strategy-advanced/bull-put-credit-spread.md) | Balanced | Bullish / buy dips | `xfinance-strategy-bull-put-credit-spread` | [`skill-bull-put-credit-spread`](../../../.cursor/skills/skill-bull-put-credit-spread/SKILL.md) |
| **Calendar spread** | [calendar-spread.md](../options-strategy-advanced/calendar-spread.md) | Balanced | Neutral–directional / term structure | `xfinance-strategy-calendar-spread` | [`skill-calendar-spread`](../../../.cursor/skills/skill-calendar-spread/SKILL.md) |
| **Diagonal spread** | [diagonal-spread.md](../options-strategy-advanced/diagonal-spread.md) | Aggressive | Bullish + rolls | `xfinance-strategy-diagonal-spread` | [`skill-diagonal-spread`](../../../.cursor/skills/skill-diagonal-spread/SKILL.md) |
| **Iron condor** | [iron-condor.md](../options-strategy-advanced/iron-condor.md) | Balanced | Range-bound | `xfinance-strategy-iron-condor-advanced` | [`skill-iron-condor`](../../../.cursor/skills/skill-iron-condor/SKILL.md) |
| **Poor man’s covered call** | [poor-mans-covered-call.md](../options-strategy-advanced/poor-mans-covered-call.md) | Aggressive | Bullish LEAP + income | `xfinance-strategy-poor-mans-covered-call` | [`skill-poor-mans-covered-call`](../../../.cursor/skills/skill-poor-mans-covered-call/SKILL.md) |
| **LEAP + CC overlay** | [leap-call-cc-overlay.md](../options-strategy-advanced/leap-call-cc-overlay.md) | Aggressive | Bullish leverage | `xfinance-strategy-leap-call-cc-overlay` | [`skill-leap-call-cc-overlay`](../../../.cursor/skills/skill-leap-call-cc-overlay/SKILL.md) |
| **Broken wing butterfly** | [broken-wing-butterfly.md](../options-strategy-advanced/broken-wing-butterfly.md) | Balanced | Neutral–skewed | `xfinance-strategy-broken-wing-butterfly` | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Ratio spread** | [ratio-spread.md](../options-strategy-advanced/ratio-spread.md) | Aggressive | Directional / vol | `xfinance-strategy-ratio-spread` | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **ZEBRA** | [zebra.md](../options-strategy-advanced/zebra.md) | Aggressive | Directional | `xfinance-strategy-zebra` | [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md) |

**Mongo seed (nested, admin/xOptions catalog):** still under [`../options-strategy/`](../options-strategy/README.md) — one folder per slug; not the same paths as Finance KB flat files.

Shared principles: [`skill-options-principles`](../../../.cursor/skills/skill-options-principles/SKILL.md).

### HNWI Desk Report v2.1 — xChat quick-action slugs (risk / outlook defaults)

| Template slug (`prompt_templates.slug`) | Desk focus | Default risk bucket | Default outlook bias |
|----------------------------------------|------------|---------------------|----------------------|
| **`hnwi-v21-concentration`** | Book concentration + one hedge/diversify idea | Balanced | Neutral |
| **`hnwi-v21-wheel-cc`** | Wheel / covered call / CSP income scan | Balanced | Neutral |
| **`hnwi-v21-protective-puts`** | Protective put checklist on largest lines | Conservative | Bearish |
| **`hnwi-v21-watchlist-pass`** | Watchlist themes vs holdings | Balanced | Bullish |
| **`hnwi-v21-options-desk`** | Holdings + watchlist options pass | Balanced | Neutral |

---

## Output contract (holdings + watchlist / Wheel · CC scan)

**xChat (HNWI template + income-ideas optimization):** the assistant answers with a **formatted markdown desk report** (headings and/or a table) so users see strike, expiry, premium, sizing, annualized ROC, and assignment risk at a glance. The **same field names, enums, and limits** as below apply to each idea — do **not** make the entire reply a lone JSON object.

**Authoring / RAG reference:** the JSON envelope below is the **canonical machine shape** for field semantics; strategy narrative files may still show it for tooling. Each strategy narrative sets `ideaType` to that strategy’s slug (see per-file **Output contract** sections).

```json
{
  "ideas": [
    {
      "ideaType": "[strategy_type]",
      "underlying": "[TICKER]",
      "strike": [NUMBER],
      "expiry": "YYYY-MM-DD",
      "premium": [NUMBER],
      "contractsRecommended": [1-5],
      "maxContracts": [NUMBER],
      "annualizedROC": [NUMBER],
      "probabilityOfProfit": [0-100],
      "assignmentRiskNote": "[Risk Level]. [Key risk detail with % OTM or buffer]. [Impact on position].",
      "rationale": "[Strategy logic + liquidity + outlook alignment. Max 220 characters.]"
    }
  ],
  "disclaimer": "Not financial advice. Past performance is not indicative of future results."
}
```

| Field | Rules |
|-------|--------|
| `ideaType` | `covered_call`, `wheel`, `cash_secured_put`, `iron_condor`, `bull_put_spread`, `bull_call_spread`, `calendar_spread`, `diagonal_spread`, `butterfly`, `jade_lizard`, `ratio_spread`, `zebra` (match the active strategy narrative). |
| `contractsRecommended` | Integer **1–5** from inventory/cash and liquidity. |
| `maxContracts` | Integer ≥ `contractsRecommended`; hard cap for the line. |
| `annualizedROC` | Decimal percent (e.g. `1.8` = 1.8%). |
| `probabilityOfProfit` | Integer **0–100**. |
| `assignmentRiskNote` | ≤180 chars: **risk level** + **% OTM/buffer** + **position impact**. |
| `rationale` | ≤220 chars: strategy logic + liquidity + outlook alignment. |

Return **up to three** `ideas` when the book and watchlist support it.

---

## Related indexes

- [Documentation index (atx-docs)](../../../README.md) — ops, xChat, options, backlog.
- [Cursor skills index](../../../.cursor/skills/README.md) — all `skill-*` folders.

---

*Not financial advice; educational / product context only.*
