<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

> **Canonical Finance KB index:** [`../../options-strategy-core/options-coreskills.md`](../../options-strategy-core/options-coreskills.md). This file remains the **Mongo `options-strategy`** nested catalog hub (stem/stem.md links); lean + advanced playbooks live under **`options-strategy-core/**`** and **`options-strategy-advanced/**`**.

# atx-options — strategy reference

**aTx Finance · options education & agent context**

Short-form strategy narratives (Markdown + frontmatter) plus links to **executable** Cursor skills under `.cursor/skills/skill-*`. Use the **narrative** files for human-readable semantics; use the **SKILL** files when dispatching agents or validating playbook depth.

**Columns in the strategy map:** **Risk** aligns with each narrative’s **Risk Profile** (summary). **Outlook** is the implied market / regime bias for the structure (not a prediction).

---

## Table of contents

- [How this tree is organized](#how-this-tree-is-organized)
- [Strategy map (narrative ↔ risk ↔ outlook ↔ skill)](#strategy-map-narrative-risk-outlook-skill)
- [Related indexes](#related-indexes)

---

## How this tree is organized

| Layer | Location | Role |
|-------|----------|------|
| **Narrative** | [`<slug>/<slug>.md`](../wheel/wheel.md) (example) | One file per folder (**folder name = file stem**) so RAG uploads keep stable path tags. Frontmatter `id` / `name`: `xfinance-strategy-*`. |
| **Agent skills** | [`.cursor/skills/skill-*/SKILL.md`](../../../../.cursor/skills/skill-wheel-strategy/SKILL.md) (example) | Full playbooks for Cursor — strikes, rolls, assignment, checks. |
| **This index** | [`options-coreskills.md`](./options-coreskills.md) | Strategy ↔ narrative ↔ **risk** ↔ **outlook** ↔ automation id ↔ Cursor skill. |

**Mongo:** `seed:admin` / `seed:options-strategy-*` sync this tree into **`options_strategy`** (and prefs). **xAI:** canonical **Finance** collection (`XAI_FINANCE_COLLECTION_ID`, default `collection_b75e188e-e7e6-4aa8-8e01-23caf0946236`) — sync via **`npm run seed:finance-xai-collection`** or **Admin → Personas → Sync Finance Collection to xAI**; do not duplicate full narrative MD into Mongo **`xchat_rag_chunks`**. **Doc entry:** [`atx-docs/README.md`](../../../README.md) § *Options (RAG + seed)*.

---

## Strategy map (narrative ↔ risk ↔ outlook ↔ skill)

| Strategy | Narrative doc | Risk | Outlook | `xfinance-strategy-*` id | Cursor skill (detail) |
|----------|----------------|------|---------|---------------------------|------------------------|
| **Covered calls** | [covered-calls.md](../covered-calls/covered-calls.md) | Moderate (capped upside) | Neutral–bullish (income on long shares) | `xfinance-strategy-covered-calls` | [`skill-covered-calls`](../../../../.cursor/skills/skill-covered-calls/SKILL.md) |
| **Cash-secured puts** | [cash-secured-puts.md](../cash-secured-puts/cash-secured-puts.md) | Moderate (assignment obligation) | Bullish / willing to own at lower effective cost | `xfinance-strategy-cash-secured-puts` | [`skill-cash-secured-puts`](../../../../.cursor/skills/skill-cash-secured-puts/SKILL.md) |
| **Wheel** | [wheel.md](../wheel/wheel.md) | Moderate–aggressive (volatility, assignment) | Bullish accumulation cycle (CSP → CC) | `xfinance-strategy-wheel` | [`skill-wheel-strategy`](../../../../.cursor/skills/skill-wheel-strategy/SKILL.md) |
| **Bull put credit spread** | [bull-put-credit-spread.md](../bull-put-credit-spread/bull-put-credit-spread.md) | Moderate (limited max loss) | Bullish / mildly bullish (premium on dips) | `xfinance-strategy-bull-put-credit-spread` | [`skill-bull-put-credit-spread`](../../../../.cursor/skills/skill-bull-put-credit-spread/SKILL.md) |
| **Poor man’s covered call** | [poor-mans-covered-call.md](../poor-mans-covered-call/poor-mans-covered-call.md) | Moderate–aggressive (LEAP leverage) | Bullish (long LEAP + short-call income) | `xfinance-strategy-poor-mans-covered-call` | [`skill-poor-mans-covered-call`](../../../../.cursor/skills/skill-poor-mans-covered-call/SKILL.md) |
| **Diagonal spread** | [diagonal-spread.md](../diagonal-spread/diagonal-spread.md) | Moderate–aggressive (time / vol flexibility) | Bullish with near-term theta overlay | `xfinance-strategy-diagonal-spread` | [`skill-diagonal-spread`](../../../../.cursor/skills/skill-diagonal-spread/SKILL.md) |
| **Bull call debit spread** | [bull-call-debit-spread.md](../bull-call-debit-spread/bull-call-debit-spread.md) | Moderate (capped risk / reward) | Bullish (defined-risk leverage) | `xfinance-strategy-bull-call-debit-spread` | [`skill-bull-call-debit-spread`](../../../../.cursor/skills/skill-bull-call-debit-spread/SKILL.md) |
| **Iron condor** | [iron-condor.md](../iron-condor/iron-condor.md) | Moderate (defined risk if range holds) | Neutral / range-bound premium | `xfinance-strategy-iron-condor` | [`skill-iron-condor`](../../../../.cursor/skills/skill-iron-condor/SKILL.md) |
| **Calendar spread** | [calendar-spread.md](../calendar-spread/calendar-spread.md) | Moderate (volatility differential) | Neutral–directional (term structure / theta vs. long leg) | `xfinance-strategy-calendar-spread` | [`skill-calendar-spread`](../../../../.cursor/skills/skill-calendar-spread/SKILL.md) |
| **Broken wing butterfly** | [broken-wing-butterfly.md](../broken-wing-butterfly/broken-wing-butterfly.md) | Moderate (defined risk when closed) | Neutral–directional (skewed wing) | `xfinance-strategy-broken-wing-butterfly` | [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Jade lizard** | [jade-lizard.md](../jade-lizard/jade-lizard.md) | Moderate | Neutral–bullish (put risk; call side capped by spread) | `xfinance-strategy-jade-lizard` | [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **Ratio spread** | [ratio-spread.md](../ratio-spread/ratio-spread.md) | Aggressive | Directional / event vol (structure-dependent) | `xfinance-strategy-ratio-spread` | [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **ZEBRA** | [zebra.md](../zebra/zebra.md) | Aggressive | Directional (bullish or bearish variant) | `xfinance-strategy-zebra` | [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md) |
| **LEAP + CC overlay** | [leap-call-cc-overlay.md](../leap-call-cc-overlay/leap-call-cc-overlay.md) | Aggressive (leverage, decay) | Bullish aggressive (LEAP + overlay income) | `xfinance-strategy-leap-call-cc-overlay` | [`skill-leap-call-cc-overlay`](../../../../.cursor/skills/skill-leap-call-cc-overlay/SKILL.md) |

*The four strategies above link to [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md) until dedicated `skill-*` playbooks ship.*

Shared principles (not a single strategy): [`skill-options-principles`](../../../../.cursor/skills/skill-options-principles/SKILL.md).

### Quant desk (quant-trader persona — Monte Carlo / multi-book)

| Topic | Narrative doc | Risk | Outlook | `xfinance-strategy-*` id |
|-------|----------------|------|---------|---------------------------|
| **Monte Carlo wheel** | [quant-monte-carlo-wheel.md](../quant-monte-carlo-wheel/quant-monte-carlo-wheel.md) | Balanced | High-IV income / wheel | `xfinance-strategy-monte-carlo-wheel` |
| **Multi-portfolio aggregation** | [portfolio-level-quant-aggregation.md](../portfolio-level-quant-aggregation/portfolio-level-quant-aggregation.md) | — | Multi-book | `xfinance-strategy-portfolio-quant-aggregation` |
| **VaR / CVaR / drawdown gates** | [drawdown-and-risk-metric-playbook.md](../drawdown-and-risk-metric-playbook/drawdown-and-risk-metric-playbook.md) | — | Tail metrics | `xfinance-strategy-drawdown-risk-metrics` |
| **IV rank filtering** | [iv-rank-strategy-selection-and-filtering.md](../iv-rank-strategy-selection-and-filtering/iv-rank-strategy-selection-and-filtering.md) | — | High vol / premium sell | `xfinance-strategy-iv-rank-filtering` |
| **Risk tier parameters** | [conservative-balanced-aggressive-quant-parameters.md](../conservative-balanced-aggressive-quant-parameters/conservative-balanced-aggressive-quant-parameters.md) | All tiers | Cross-cutting | `xfinance-strategy-quant-risk-tiers` |

Uploaded to Finance KB via **`refresh-finance`** (nested quant folders only — not the full `options-strategy/**` tree). **`quant-trader`** persona **`always_include`** lists **`options-strategy/**`** + core/advanced.

### HNWI Desk Report v2.1 — xChat quick-action slugs (risk / outlook defaults)

| Template slug (`prompt_templates.slug`) | Desk focus | Default risk bias | Default outlook bias |
|----------------------------------------|------------|-------------------|----------------------|
| **`hnwi-v21-concentration`** | Book concentration + one hedge/diversify idea | Moderate | Neutral |
| **`hnwi-v21-wheel-cc`** | Wheel / covered call / CSP income scan | Moderate | Neutral |
| **`hnwi-v21-protective-puts`** | Protective put checklist on largest lines | Conservative | Bearish |
| **`hnwi-v21-watchlist-pass`** | Watchlist themes vs holdings | Moderate | Bullish |
| **`hnwi-v21-options-desk`** | Holdings + watchlist options pass | Moderate | Neutral |

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
- [Cursor skills index](../../../../.cursor/skills/README.md) — all `skill-*` folders.

---

*Not financial advice; educational / product context only.*
