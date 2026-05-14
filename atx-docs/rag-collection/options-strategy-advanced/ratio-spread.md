---
id: xfinance-strategy-ratio-spread
name: xfinance-strategy-ratio-spread
description: Ratio spread — unequal number of long vs short options; capital efficiency with tail risk to size explicitly.
---

<!-- OUTPUT CONTRACT: Always return valid JSON matching the standardized schema below -->

# xFinance Strategy: Ratio spread

**One-sentence definition:** Open **more shorts than longs** (or the mirror) at related strikes to shape payoff — **extra naked wings** can create **large tail risk** if not boxed or hedged.

**Best market conditions:** Skew / vol views where you **intentionally** accept asymmetric tail for credit or cheaper debit; **pro** desk with risk software.

**Risk bucket:** **Aggressive** (uncapped or large tail on the unbalanced side).

**Payoff profile:** **Structure-specific** — example **1×2 call ratio** (long 1 lower, short 2 higher): max loss can be **unbounded** above upper strikes if uncovered — **always** model.

| | |
|--|--|
| **Max profit** | Often **capped plateau** in a zone — model |
| **Max loss** | Can be **large / unlimited** if naked |
| **Breakeven** | One or two roots — model |

**Position sizing rules:** Only run with **explicit worst-case** at **±X%** gap; cap **contracts** so tail loss **≤** policy **1R** *including gap*.

**Worked example (illustrative):** **SPY** **1×2** call ratio: long **$500**, short **2× $510** — profits if SPY pins **near $510** at expiry but **loses** accelerate above **~$520** region (illustrative; **verify**).

**When to avoid:** Retail-sized accounts without margin clarity; single-leg “fixes” that accidentally leave **naked** shorts.

**Tax & assignment (HNWI — not tax advice):** Assignment on ratio legs can create **odd stock** hedges — reconcile same day; CPA for straddle/identification if mixing long/short in same name.

**Quick reference**

| Check | Pass/Fail |
|-------|-----------|
| **Tail modeled** | Must pass |
| **Margin** | SPAN / house worst case |

## Guardrails

- Prefer **fully closed** ratio boxes unless mandate allows naked.
- **Liquidity** on **all** strikes — ratios are fragile to slippage.

## Output contract

Return **only** valid JSON (no markdown fences, no commentary).

```json
{
  "ideas": [
    {
      "ideaType": "ratio_spread",
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

**assignmentRiskNote** (≤180 chars): risk level + % OTM/buffer + position impact.

**rationale** (≤220 chars): strategy logic + liquidity + outlook only.
