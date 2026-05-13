# Spring read plane and exiting Next → Mongo (production)

## Goal

Run **production** product traffic so the **browser only talks to Next** (SSR, auth cookies, static assets), while **data reads and writes** for hot paths go through **atxfinance-backend (Spring)** — eventually **without** Next opening a Mongo client for those paths.

Today: Next still uses Mongo for many **GET** handlers, persona governance, xChat tool-loop, tenant admin, etc. Writes are being pushed to Spring via the BFF per [`mongo-next-write-boundary.md`](./mongo-next-write-boundary.md).

## Thin read layer (Spring)

**Definition:** Spring exposes **read-only HTTP** (or gRPC later) that returns the same JSON contracts as today’s Next `GET` routes, backed by:

- **Direct Mongo reads** in Kotlin (same `MONGODB_URI` cluster), with session/tenant filters identical to Next; and/or
- **Redis read-through** for denormalized payloads (already used for **`GET /api/portfolios/{id}/snapshot`** — see [`api-consolidation-spring-backend.md`](./api-consolidation-spring-backend.md) § heavy read offload).

**Rollout pattern:**

1. Add Kotlin controller + tests mirroring the Next response envelope.
2. Register **`GET`** in [`src/lib/bff-proxy-routes.ts`](../../src/lib/bff-proxy-routes.ts) and extend `proxyPortfolioRequestToBackend` / `proxyAdminUsersRequestToBackend` gates as needed.
3. Remove or branch Mongo code in the Next route handler once BFF is always on for that path.

Prioritize **high QPS, low branching** reads first: portfolio summary, workspace snapshot consumers, positions list — then admin directory reads that are already JVM-parity in places.

## Materialized views (Mongo alternative)

When Spring should **not** hit primary OLTP collections for heavy scans:

- Maintain **materialized collections** (e.g. `portfolio_workspace_snapshots`, precomputed watchlist strips) updated by **Spring workers** or change-stream consumers.
- Spring read APIs query those collections or Redis keys only; Next stops reading the hot primary path.

Use this when Kotlin read path would otherwise duplicate complex Next aggregations or overload `portfolio_positions` / watchlist during US session.

## Production: `ATXFINANCE_BACKEND_ORIGIN` required

- **Deploy time:** `scripts/ops/deploy-cloud-run-from-env.sh` and GitHub **Deploy Cloud Run** workflows already fail if `ATXFINANCE_BACKEND_ORIGIN` is missing, not `https://`, equals public `BASE_URL`, or contains `:8080` on public hosts.
- **Runtime:** Next **`instrumentation.ts`** calls `assertHostedCloudRunRequiresAtxfinanceBackendOrigin()` so a Cloud Run revision with `NODE_ENV=production` and `ATX_DEPLOY_TARGET` **`stage`** or **`deploy`** cannot start without **`ATXFINANCE_BACKEND_ORIGIN`** set (prevents silent Mongo-only prod).
- **Break-glass:** set **`ALLOW_MISSING_ATXFINANCE_BACKEND_ORIGIN=1`** on the service (document in incident notes; remove after fix).

## Related

- [`mongo-next-write-boundary.md`](./mongo-next-write-boundary.md) — write policy + ESLint.
- [`atxfinance-backend-http-api.md`](./atxfinance-backend-http-api.md) — Spring route inventory.
- [`guides/deploy-and-ops.md`](../guides/deploy-and-ops.md) — env matrix and CLI deploy.
