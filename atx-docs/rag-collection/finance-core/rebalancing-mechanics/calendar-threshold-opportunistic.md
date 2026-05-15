# atx-rag-collection/finance-core/rebalancing-mechanics/calendar-threshold-opportunistic.md

---
id: xfinance-finance-core-rebalancing-calendar-threshold
name: finance-core-rebalancing-scanners
description: Calendar vs threshold vs opportunistic rebalancing and how scheduled scanners surface drift
complexity: core
underlying_type: stock
strategy_type: portfolio_maintenance
risk_level: balanced
tags: [finance_core, rebalance, calendar, threshold, scanners, scheduled_tasks]
---

# Rebalancing mechanics — calendar, threshold, opportunistic

Ties desk language to **automated monitors** (admin / tenant scheduled jobs) that surface drift; execution remains user/custodian-driven unless product explicitly automates trades.

## Calendar rules

- **Fixed cadence** — monthly/quarterly/annual resets toward policy weights; simple to explain; may rebalance **into** momentum late.
- **Cash-flow integration** — use contributions/withdrawals to **net** drift toward targets without sells.

## Threshold rules

- **Drift bands** — act when any sleeve exceeds ±**X%** vs target; reduces churn vs pure calendar.
- **Tax-aware thresholds** — wider bands in taxable books when gains bite; pair with `tax-strategies/` TLH discussion.

## Opportunistic / cash-flow rules

- **Rebalance on cash events** — dividends, bonuses, tax refunds deployed toward underweight sleeves.
- **Volatility-aware** — widen thresholds in high-vol regimes to avoid whipsaw (policy choice).

## Scheduled scanners (product alignment)

- **Watchlist / options scanners** — tenant-scoped jobs can flag price, IV, or structural triggers; they **notify**; they do not silently trade.
- **Desk copy** — when users ask “why did I get an alert?”, tie back to **threshold** logic and last known snapshot from tools.

## xChat

- Compare **`positions_snapshot`** vs stated targets when user provides targets; if targets absent, supply **ranges** and ask for IPS numbers.
