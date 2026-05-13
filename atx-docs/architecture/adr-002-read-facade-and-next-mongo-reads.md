# ADR 002 — Read facade and Next.js direct Mongo reads

**Status:** Accepted  
**Date:** 2026-05-12  
**Context:** Production goal is for hot paths to use **Spring (atxfinance-backend)** for reads/writes via the Next BFF, reducing direct Mongo usage from the Node runtime.

## Decision

1. Introduce a **versioned read facade** `GET /api/read/product-shell-v1` (Spring + Next proxy) that bundles **default portfolio summary** + optional **cached workspace snapshot** in one round-trip for shell pages.
2. Track remaining **Next-only Mongo reads** explicitly with **target removal quarters** (calendar); dates are planning anchors — adjust in PR when scope slips.

## Read facade (implemented)

| Surface | Path | Notes |
|--------|------|--------|
| Spring | `GET /api/read/product-shell-v1` | Kotlin `ReadFacadeController`; timing headers `X-Atx-Read-Facade-*-Ms`. |
| Next BFF | Same path | Proxies when `ATXFINANCE_BACKEND_ORIGIN` set; Mongo fallback otherwise. |

## Routes / areas still using direct Mongo reads in Next (non-exhaustive inventory)

Listed as **user-facing GET / server loaders** or high-frequency API routes where the handler still resolves data via `getDb()` / `src/modules/**` without Spring parity on the **happy path** in production. “Removal” means **Spring authoritative + BFF proxy on** and Next handler slimmed to proxy-only or deleted.

| Route / area | Still direct Mongo read? | Planned removal / parity |
|--------------|--------------------------|---------------------------|
| `GET /api/personas`, `GET /api/personas/{id}` | Yes (governance, tenant scope) | **2026 Q3** — JVM read + cache; Next thin proxy only. |
| `POST /api/xchat/ask`, xChat history, token stats, attachments | Yes (core product) | **2026 Q4** — phased; ask body may stay Next until stream parity (see `api-consolidation-spring-backend.md`). |
| `GET /api/app-user/find-options/bootstrap`, `GET …/context`, symbol chart | Yes (Next-only by design today) | **2026 Q3** — Spring read facade slice or materialized bootstrap doc. |
| `GET /api/strategy-options/expirations` | Yes (Yahoo from Next) | **2026 Q3** — optional JVM mirror or keep Next if latency OK. |
| `GET /api/portfolios/{id}/watchlist` (app user) | Yes (`PATCH` proxies when BFF on; `GET`/`POST` stay Next) | **2026 Q2** — JVM quotes for `GET` or document permanent Next read ownership. |
| `GET /api/portfolios/{id}/alerts` (app user) | Yes | **2026 Q3** — align with Spring or keep Next with ADR update. |
| `GET /api/admin/tenants`, `GET /api/admin/login-audit`, `GET /api/admin/audit` (subset) | Yes when BFF skips admin GETs | **2026 Q2–Q3** — per-entity Kotlin parity + remove `ADMIN_USERS_BFF_NEXT_ONLY_GET_PATHS` entries. |
| `GET /api/admin/tasks`, task-runs, scheduler tick | Yes (Next-orchestrated) | **2026 Q4** — only if product moves scheduler authority to JVM; else mark **permanent Next**. |
| Marketing / desk SMTP / billing webhooks | Mixed | **TBD** — not product-shell hot path; revisit with tenant roadmap. |

**Already proxied for reads when BFF on:** most of `BFF_PROXY_ROUTES` in `src/lib/bff-proxy-routes.ts` (portfolios, positions, recommendations, strategy-jobs, admin portfolios subtree, etc.) — those Next handlers still contain **Mongo fallback** for local dev until fallback code is removed.

## Consequences

- **Latency:** Extra hop (browser → Next → Spring) must stay within agreed budget; see **`atx-docs/sre-ops/bff-read-facade-latency-measurement.md`**.
- **Contracts:** `bff-proxy-routes`, `atxfinance-backend-http-api.md`, and smoke parity tests must update with every new facade or proxy toggle.

## Related

- `atx-docs/sre-ops/spring-read-plane-and-mongo-exit.md`  
- `atx-docs/sre-ops/mongo-next-write-boundary.md`  
- `atx-docs/sre-ops/bff-read-facade-latency-measurement.md`
