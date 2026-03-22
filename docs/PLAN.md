# PLAN — backlog, gaps, design TBD

Tracked follow-ups from doc/ops reviews. **Not blocking** staging or merge unless explicitly promoted to a ticket.

## Documentation & process

| Status | Item |
|--------|------|
| **TODO** | **CONTRIBUTING.md** — Optional one-liner: new session-facing product APIs should be listed in `DEVELOPMENT.md` § API and linked from `README.md` when user-visible. |
| **TODO** | **test-commit-push CHECKLIST** — Optional checkbox: “Deferred items captured in `docs/PLAN.md` (if any) reviewed or consciously skipped.” |
| **Design TBD** | **User-facing privacy / retention** — Short note for app_user **Feedback** (`POST /api/feedback`): what is stored (Slack vs logs only), retention, and whether copy in the modal should link to a policy page. |

## Testing & QA

| Status | Item |
|--------|------|
| **TODO** | **E2E / Playwright** — Smoke for app_user header: profile popover, logout, feedback modal submit (happy path + unauthenticated). |
| **Design TBD** | Where E2E lives (`tests/e2e` vs CI job) and whether it runs on every PR or nightly. |

## Product / UX

| Status | Item |
|--------|------|
| **Design TBD** | **Brand pivot execution (institutional licensing)** — xCoach is deprecated; xStrategyBuilder is now the primary product story. Complete copy/token updates across marketing, nav, and pricing surfaces to reflect B2B white-label/API/SaaS offerings. |
| **TODO** | **Licensing packaging matrix** — Define contractual SKUs for (1) white-label, (2) API-first, (3) managed hosted SaaS with seat/usage add-ons and support tiers. |
| **TODO** | **Institutional proof points** — Add measurable benchmarks for strategy generation, Greeks latency, and backtest throughput to support enterprise procurement review. |
| **Design TBD** | **Plans landing** (signed-in, not yet approved) — Header is minimal vs full `AppUserApprovedHeader`; decide if parity (e.g. logout only) is desired. |
| **Done (baseline)** | **Watchlist** (`/watchlist`) — Uses `portfolio_watchlists` + `PATCH .../watchlist` (`addEntries` for Type/Strategy/Quantity/Entry Price). Further UX (multi-list, rationale column) TBD. |
| **Design TBD** | **xChat 4-agent parallel mode** — Add optional orchestration where one user ask can fan out to up to 4 specialized agents and synthesize a final answer. Define UI affordance (single response vs per-agent panes), latency budget, and fallback when 1+ agents fail/time out. |
| **TODO** | **xChat conversation identity** — Introduce stable `conversationId` / `turnId` in ask/batch logs. Current logs are per-message records only; parallel fan-out needs correlation IDs for replay, debugging, and per-agent traceability. |
| **TODO** | **Per-agent persistence model** — Extend `xchat_logs` (or adjacent collection) with `agentId`, `agentRole`, `parentTurnId`, status, and token/cost usage fields for each parallel branch. |
| **TODO** | **Concurrency guardrails** — Add per-user in-flight limits and cancellation semantics so repeated asks do not create unbounded parallel jobs. |

## OpenAPI / API inventory

| Status | Item |
|--------|------|
| **TODO** | When adding handlers under `src/app/api/**/route.ts`, keep `src/lib/openapi/current-state.ts` plus overrides in sync (existing CONTRIBUTING rule); consider a CI grep or script later. |
| **Design TBD** | If xChat parallel mode introduces async submit/poll/cancel routes, define route contracts first and keep OpenAPI parity + integration tests in the same PR. |

## xChat parallelization (architecture)

| Status | Item |
|--------|------|
| **Design TBD** | **Execution model** — choose between single-request fan-out inside `POST /api/xchat/ask` vs an explicit async job API (`POST /api/xchat/parallel` + `GET /api/xchat/parallel/:id`). |
| **TODO** | **Timeout budget** — define hard timeout per agent and overall wall-clock cap (e.g., 60s total, with best-effort partial synthesis). |
| **TODO** | **Merge strategy** — implement deterministic reducer prompt for agent outputs with confidence/error metadata and source attribution. |
| **TODO** | **Rate limits / plan limits** — update plan controls for `maxParallelAgents`, max tool calls per ask, and cost guardrails by subscription tier. |
| **TODO** | **Admin observability** — add per-agent status/error columns to admin xChat views and expose last failure class (timeout, rate limit, tool error, upstream error). |

## Institutional licensing hard requirements

| Status | Item |
|--------|------|
| **TODO** | **Ultra-low latency** — Set hard SLOs for strategy generation/Greeks/backtesting (target sub-second, stretch target <100ms for API responses where feasible), plus cache and market-data feed strategy. |
| **TODO** | **Compliance + encryption baseline** — Define SOC2 Type II workstream, FINRA/SEC audit-log coverage, encryption-at-rest/in-transit controls, explainability artifacts, and tenant isolation controls. |
| **TODO** | **Cybersecurity + model integrity** — Ship MFA, rate limiting, key rotation cadence, strategy IP protection controls, and scheduled drift/overfitting checks (backtest vs live). |

---

*Last aligned with doc gap review — extend this file instead of scattering TODOs across runbooks.*
