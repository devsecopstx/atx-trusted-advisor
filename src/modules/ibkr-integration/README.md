# IBKR integration (Phase 1–2)

Design reference: `atx-docs/design-system/ibkr-automation.md`.

## Architecture decision (Phase 1)

- **Stack:** TypeScript in this repo (Next.js server routes in later phases). Optional JVM parity can follow for BFF-proxied paths if needed.
- **Target API:** **Interactive Brokers Client Portal Web API** (HTTPS REST) as the default integration path — simpler ops than embedding TWS/IB Gateway for initial read-only and order-confirm flows. **TWS API / ib_insync** remains an alternative if sub-second latency or local Gateway is required later; document a new ADR before switching.
- **Config:** Optional `IBKR_*` environment variables parsed by `parseIbkrIntegrationConfig()` — **not** part of `getEnv()` so the core app boot sequence is unchanged when IBKR is disabled.

## Module layout

| File | Role |
|------|------|
| `types.ts` | Domain types (`IbkrAccount`, `IbkrPosition`, `IbkrOrder`, `IbkrExecution`, `IbkrAutomationRule`) |
| `config.ts` | Optional env parsing |
| `rate-limit.ts` | Sliding-window limiter for Client Portal pacing |
| `retry.ts` | Exponential backoff + jitter helper |
| `client-phase1.ts` | Stub client: `apiReachable: false` (superseded for reads by CP HTTP below) |
| `client-portfolio.ts` | `GET /v1/api/portfolio/accounts` fetch + JSON parse |
| `session-seal.ts` | AES-256-GCM seal/unseal for httpOnly CP cookie (key = SHA-256 of `AUTH_SECRET`) |
| `session-resolve.ts` | Resolve Cookie header: user sealed cookie vs env fallback |
| `consent-repository.ts` | Mongo `ibkr_user_consents` (consent only — no credentials) |

## Phase 2 (shipped)

- **API:** `GET/POST /api/integrations/ibkr/status|consent|session`, `GET accounts` — see `atx-docs/guides/api-endpoints.md`.
- **UI:** `/account/integrations/ibkr` — consent + optional session paste when allowed.
- **Session POST** allowed when **`IBKR_ALLOW_SESSION_COOKIE_BODY=true`** or **`NODE_ENV=development`**.

## Security checklist (non-negotiable — future phases)

- No passwords or session cookies in Mongo without encryption/KMS review; prefer short-lived tokens and IBKR-native session handling.
- **Paper before live:** enforce `paperTrading` in UI and server gates before enabling live order routes.
- **Audit:** log every outbound IBKR call and order lifecycle event (correlation id, user id, masked account id).
- **Rate limits + circuit breakers:** use `createIbkrRateLimiterFromConfig` + platform-level limits per user.
- **Secrets:** only vault / Secret Manager; never commit credentials.

## Environment variables (optional)

See root `.env.example` § IBKR. Defaults keep integration **off** (`IBKR_ENABLED` unset or false).

**Local gateway TLS:** the stock IBKR Client Portal gateway often uses HTTPS with a self-signed cert. Node `fetch` may reject it until you terminate TLS correctly (reverse proxy with a trusted cert) or use a dev-only TLS override — do **not** disable TLS verification in production.
