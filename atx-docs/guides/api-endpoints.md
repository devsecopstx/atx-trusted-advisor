# API Endpoints Guide

Current route inventory grouped by domain. Source of truth remains `src/app/api/**` and `/api/openapi`.

## Deep-dive docs

- `src/lib/openapi/current-state.ts` (generated inventory source)
- `atx-docs/sre-ops/atxfinance-backend-http-api.md` (Spring backend API contract)
- `atx-docs/sre-ops/api-consolidation-spring-backend.md` (Next -> Spring route migration status)

## Health and auth

- `GET /api/health`
- `GET /api/openapi`
- `GET /api/auth/x/login`
- `GET /api/auth/x/callback`
- `POST /api/auth/link-email`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Access requests and feedback

- `POST /api/access-requests`
- `POST /api/access-requests/public`
- `POST /api/user-feedback`

## Admin access requests

- `GET /api/admin/access-requests`
- `POST /api/admin/access-requests`
- `GET /api/admin/access-requests/:requestId`
- `PATCH /api/admin/access-requests/:requestId`
- `PUT /api/admin/access-requests/:requestId`
- `DELETE /api/admin/access-requests/:requestId`

## Admin users

- `GET /api/admin/users`
- `POST /api/admin/users`
- `GET /api/admin/users/approved`
- `GET /api/admin/users/:userId`
- `PUT /api/admin/users/:userId`
- `DELETE /api/admin/users/:userId` — **destructive:** purges all app data for that user id + normalized email, then removes `core_users`; **400** if target is the signed-in admin’s own id
- `PATCH /api/admin/users/:userId/email`
- `PATCH /api/admin/users/:userId/plan`
- `PATCH /api/admin/users/:userId/role`
- `GET /api/admin/users/:userId/settings`
- `PUT /api/admin/users/:userId/settings`

## Admin tasks and scheduler

- `GET /api/admin/tasks`
- `POST /api/admin/tasks`
- `POST /api/admin/tasks/:taskId/run`
- `POST /api/admin/scheduler/tick`
- `GET /api/admin/task-runs`

## Admin audit/bootstrap

- `GET /api/admin/audit`
- `GET /api/admin/bootstrap-status`

## Personas and collections

- `GET /api/personas`
- `POST /api/personas`
- `GET /api/personas/collections`
- `GET /api/personas/collections/:collectionId`
- `POST /api/personas/collections`
- `GET /api/personas/:personaId`
- `PUT /api/personas/:personaId`
- `DELETE /api/personas/:personaId`
- `POST /api/personas/:personaId/collection/create`
- `POST /api/personas/:personaId/collection/link-files`
- `POST /api/personas/:personaId/verify-collection`
- `POST /api/personas/:personaId/publish`
- `POST /api/personas/:personaId/archive`
- `POST /api/personas/:personaId/rollback`
- `GET /api/personas/:personaId/versions`

## Portfolio, positions, watchlist

**Mongo `ObjectId` hex (24 chars):** Next.js handlers normalize likely hex to **lowercase** before comparing to `toHexString()` or setting cookies (`src/lib/mongo-object-id-hex.ts`), so mixed-case query params and JSON bodies behave the same as bookmarks or pasted links. **BFF proxy:** Routes that call `proxyPortfolioRequestToBackend` (or related helpers) **before** the Next handler may forward the **original** request URL to Spring; JVM `ObjectId` parsing is case-insensitive for hex, but product deep links should still use lowercase for consistency.

- `GET /api/portfolios/default`
- `GET /api/portfolios/:portfolioId/accounts`
- `PATCH /api/portfolios/:portfolioId/accounts/:accountId` — name, cash, desk fields, custodian **`type`**; **`extAccountId`** may be updated when **`brokerImportLocked`** is false (still **409** if import-locked and body touches ref or type)
- `GET /api/user/watchlist` — canonical **user-global** watchlist (session); optional `?quotes=1`
- `PATCH /api/user/watchlist` — same store as portfolio-scoped routes below
- `GET /api/portfolios/:portfolioId/watchlist` — shim: requires owned `portfolioId`, reads/writes user watchlist. Query **`quotes=1`** adds per-symbol quotes; add **`chainGlance=1`** (only with **`quotes=1`**) to attach **`chainGlance`** `{ contractType, strike, impliedVolatilityPercent, openInterest }` per row from nearest-expiry options (Yahoo)
- `PATCH /api/portfolios/:portfolioId/watchlist` — same query params as GET when re-fetching payload after patch
- `GET /api/positions?portfolioId=&accountId=`
- `POST /api/positions`
- `DELETE /api/positions/:positionId?portfolioId=&accountId=`

Admin portfolio routes include:

- `PATCH /api/admin/portfolios/:portfolioId`
- `GET|PATCH /api/admin/portfolios/:portfolioId/watchlist`
- `POST /api/admin/import/broker`
- `POST /api/import/broker` — app-user Merrill/Fidelity **holdings** CSV (session); dry-run preview or apply via staged `app_broker_import_jobs` + immediate `sync-broker` task (`/import-activity` UI). **`mappings`** = broker account key → core account id; keys may be a **subset** of accounts parsed from the CSV (omit rows to skip import); at least one mapping required when the file contains accounts. Keys align with parser: **`accountRef || label || "default"`**
- `POST /api/import/broker/clean` — app-user **destructive** reset: deletes all positions for the portfolio, `app_broker_import_jobs` rows for that user/book, and portfolio-bound `sync-broker` scheduled tasks (session + portfolio must belong to user)

## IBKR (Client Portal — gated)

Requires **`IBKR_ENABLED`** + optional **`IBKR_CLIENT_PORTAL_BASE_URL`**. Routes are no-ops / 404 when disabled.

- `GET /api/integrations/ibkr/status` — session; flags (gateway configured, consent, sealed cookie present, whether session body POST is allowed).
- `POST /api/integrations/ibkr/consent` — session; JSON `{ accepted: boolean }`; persists `ibkr_user_consents` (no IBKR secrets).
- `POST /api/integrations/ibkr/session` — session; JSON `{ clientPortalCookie }` when **`IBKR_ALLOW_SESSION_COOKIE_BODY`** or **`NODE_ENV=development`**; seals value into httpOnly **`xf_ibkr_cp_session`** (uses **`AUTH_SECRET`**).
- `DELETE /api/integrations/ibkr/session` — clears httpOnly session cookie.
- `GET /api/integrations/ibkr/accounts` — session; **`GET …/v1/api/portfolio/accounts`** on the Client Portal gateway with resolved cookie (per-user sealed cookie, or operator-only **`IBKR_USE_ENV_SESSION_COOKIE`** + **`IBKR_CLIENT_PORTAL_SESSION_COOKIE`**).

UI: **`/account/integrations/ibkr`**.

## xStrategyBuilder / strategy options

- `GET /api/strategy-options/expirations` — session; **Next Yahoo only** (not BFF-proxied to Spring; matches local dev and avoids prod stalls when the JVM path is slow).
- `GET /api/strategy-options` — may BFF-proxy to Spring when enabled; sparse-chain fallback to Yahoo.

## Billing / payments

- `POST /api/billing/checkout-session`
- `POST /api/webhooks/stripe` — Stripe webhook receiver (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`)

## Product pages and redirects (Next.js)

These are **not** OpenAPI JSON routes; listed for operator and support alignment.

- **`/xstrategybuilder`** and **`/xstrategybuilder/*`** → **`/xoptions`** (`next.config.ts` `redirects`). Deep links do not preserve query strings; prefer **`/xoptions`** in product copy.
- **`/portfolios`**: workspace portfolio list/create/edit; custodian accounts and holdings remain on **`/portfolio`** and **`/portfolio/accounts/:accountId`** (the account page resolves the owning portfolio even when the workspace cookie differs from the focused portfolio on `/portfolios`).

## xChat

- `POST /api/xchat/ask` — Body may include optional **`portfolioId`** (24-char Mongo id, user-owned portfolio) so workspace snapshot and **`atx_function`** resolve that portfolio instead of the cookie/default — align with **`/watchlist?portfolioId=`** or open **`/xchat?portfolioId=`** for the same scope. Deterministic **“show my watchlist”** style prompts return a direct watchlist listing with **Spot** and **Target entry** in **`$`** (no per-row **added** timestamps). JSON `data` includes `model`, `logId`, collection search status fields, and optional `xaiUsage` (token counts) when xAI returns a `usage` object; optional `strategyJobOffer`, `multiAgentDowngraded` / `personaModelRequested`. The `/xchat` Persona rail **Status** shows last model plus last-turn and session token sums from `xaiUsage` when present.
- `POST /api/xchat/batch`
- `GET /api/xchat/batch`
- `GET /api/xchat/batch/:batchId`
- `POST /api/xchat/batch/:batchId`

## API docs validation checklist

1. `GET /api/openapi` returns 200.
2. `GET /admin/api-docs` loads in admin session.
3. `tests/integration/openapi-current-state-coverage.test.ts` passes.
4. `tests/integration/openapi-document-build.test.ts` passes.

For xChat-specific API semantics (persona resolution, batch behavior), see `atx-docs/guides/xchat-personas.md`.
