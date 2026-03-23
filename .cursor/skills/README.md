# atxFinance Project Skills

Project-local skills in this directory are safe for Cursor Cloud Agents to reuse across runs.

## Included Skills

- `atxfinance-docs-ops`: update operational docs and runbooks without runtime changes.
- `generate-docs`: keep README, DEVELOPMENT, AGENTS, and related docs aligned with code and ops reality.
- `test-commit-push`: run lint/typecheck/test (and build when needed), then commit/push/PR with checklist hygiene.
- **Cursor rules** (sibling folder `../rules/*.mdc`, tracked in git): optional file rules with `globs` — e.g. `xfinance-chat-expert.mdc` for xChat-focused sessions. See `generate-docs` and `test-commit-push` checklists when editing.
- `atxfinance-xchat-validation-checklist`: run repeatable local/staging xChat validation checks.
- `atxfinance-runbook-navigator`: route operators to the right runbook section and next command.
- `atxfinance-design-ops`: run concise design/ops review gates for core tools and xPersona contracts.
- `xdesign-review`: final MVP merge gate for combined core MVP + branding cloud-agent changes.

### Backend (multi-node agents)
- `atxfinance-backend-architecture`
- `atxfinance-backend-deploy-staging`
- `atxfinance-backend-deploy-production`
- `atxfinance-backend-runbook`
- `atxfinance-backend-ci`
- `atxfinance-backend-start-local`
- `atxfinance-backend-start-staging`

Guidelines: see `docs/ops/junie-guidelines-atxfinance-backend.md` for how Junie should operate these skills safely.

## GCP / infra

- `atxfinance-gcp-foundation`: DNS, HTTPS LB, host rules, Cloud Run mapping, secret/env matrix.
- `gcp-env-atx-recreate`: manual `gcloud` recreate for `staging.atx` / `atx` Cloud Run (buildpack deploy from monorepo root); pair with `atxfinance-gcp-foundation` for LB/DNS.

## Strategy Skills

- `atxfinance-strategy-covered-calls`: covered calls on TSLA shares (very high usage, moderate risk).
- `atxfinance-strategy-cash-secured-puts`: OTM cash-secured puts on TSLA/RKLB/RDW (very high usage, moderate risk).
- `atxfinance-strategy-wheel`: CSP-to-CC reinvestment cycle (high usage, moderate-aggressive risk).
- `atxfinance-strategy-bull-put-credit-spread`: defined-risk premium spreads on dips (high usage, moderate risk).
- `atxfinance-strategy-poor-mans-covered-call`: LEAP + short-call overlay (high usage, moderate-aggressive risk).
- `atxfinance-strategy-diagonal-spread`: long LEAP with short near-term calls (medium-high usage, moderate-aggressive risk).
- `atxfinance-strategy-bull-call-debit-spread`: leveraged bullish debit spreads (medium-high usage, moderate risk).
- `atxfinance-strategy-iron-condor`: range-bound defined-risk premium strategy (medium-high usage, moderate risk).
- `atxfinance-strategy-calendar-spread`: same-strike term-structure theta strategy (medium usage, moderate risk).
- `atxfinance-strategy-leap-call-cc-overlay`: long ITM LEAP with weekly overlays (medium usage, aggressive risk).

## Scope Constraints

- These skills are intentionally non-destructive.
- They must not deploy services, rotate keys, or mutate production/staging secrets.
- Runtime xChat tool execution work is tracked separately and is not implemented here.
