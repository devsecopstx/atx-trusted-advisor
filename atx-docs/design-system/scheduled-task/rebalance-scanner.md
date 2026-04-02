# Job name
Rebalance Scanner
# Purpose
Detects allocation drift vs user-defined targets; flags suggested trades (sell overweight, buy underweight) with tax-impact estimate.
# Suggested frequency
Daily (market close) or weekly
# Per-portfolio summary example
“Drift scan: 3 positions flagged (TSLA +8%). Est. tax cost on harvest: $1,240. Recommended trades: 2 sells / 1 buy.”

> **Phase 3 — shipped (app ≥2.9.0):** Category **`rebalance`** (equal-weight drift heuristic); **`runRebalanceScanner`** — [scanners-phase3-plan.md](./scanners-phase3-plan.md).