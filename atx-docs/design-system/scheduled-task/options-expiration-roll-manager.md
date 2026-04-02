# Job name
Options Expiration & Roll Manager
# Purpose
Flags expiring positions (calls/puts); suggests rolls, closes, or new income trades based on current chain + prefs.
# Suggested frequency
Every 15 min during market hours + EOD
# Per-portfolio summary example
“Expiration scan: 5 positions due in <7 DTE. 3 recommended rolls (credit $2,850). 2 BUY_TO_CLOSE alerts.”

> **Phase 3 (planned):** Heavy user of shared option chain cache + circuit breaker — [scanners-phase3-plan.md](./scanners-phase3-plan.md).