# xFinance Project Skills

Project-local skills in this directory are safe for Cursor Cloud Agents to reuse across runs.

## Included Skills

- `xfinance-docs-ops`: update operational docs and runbooks without runtime changes.
- `xfinance-xchat-validation-checklist`: run repeatable local/staging xChat validation checks.
- `xfinance-runbook-navigator`: route operators to the right runbook section and next command.

## Scope Constraints

- These skills are intentionally non-destructive.
- They must not deploy services, rotate keys, or mutate production/staging secrets.
- Runtime xChat tool execution work is tracked separately and is not implemented here.
