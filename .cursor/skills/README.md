# xFinance Project Skills

Project-local skills in this directory are safe for Cursor Cloud Agents to reuse across runs.

## Included Skills

- `xfinance-docs-ops`: update operational docs and runbooks without runtime changes.
- `xfinance-xchat-validation-checklist`: run repeatable local/staging xChat validation checks.
- `xfinance-runbook-navigator`: route operators to the right runbook section and next command.
- `xfinance-design-ops`: run concise design/ops review gates for core tools and xPersona contracts.

## Strategy Skills

- `xfinance-strategy-covered-calls`: covered calls on TSLA shares (very high usage, moderate risk).
- `xfinance-strategy-cash-secured-puts`: OTM cash-secured puts on TSLA/RKLB/RDW (very high usage, moderate risk).
- `xfinance-strategy-wheel`: CSP-to-CC reinvestment cycle (high usage, moderate-aggressive risk).
- `xfinance-strategy-bull-put-credit-spread`: defined-risk premium spreads on dips (high usage, moderate risk).
- `xfinance-strategy-poor-mans-covered-call`: LEAP + short-call overlay (high usage, moderate-aggressive risk).
- `xfinance-strategy-diagonal-spread`: long LEAP with short near-term calls (medium-high usage, moderate-aggressive risk).
- `xfinance-strategy-bull-call-debit-spread`: leveraged bullish debit spreads (medium-high usage, moderate risk).
- `xfinance-strategy-iron-condor`: range-bound defined-risk premium strategy (medium-high usage, moderate risk).
- `xfinance-strategy-calendar-spread`: same-strike term-structure theta strategy (medium usage, moderate risk).
- `xfinance-strategy-leap-call-cc-overlay`: long ITM LEAP with weekly overlays (medium usage, aggressive risk).

## Scope Constraints

- These skills are intentionally non-destructive.
- They must not deploy services, rotate keys, or mutate production/staging secrets.
- Runtime xChat tool execution work is tracked separately and is not implemented here.
