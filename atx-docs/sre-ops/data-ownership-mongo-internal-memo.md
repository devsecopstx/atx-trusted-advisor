# Internal memo: Mongo ownership and the BFF (Spring) plane

**Audience:** Core eng + SRE  
**Status:** Living summary — code + `mongo-next-write-boundary.md` win on detail.

## One rule

**For product mutations that are in scope of the JVM consolidation, Spring (atxfinance-backend) owns Mongo writes when the BFF is active.** The Next.js app is the browser’s same-origin edge: it authenticates the session, then **forwards** eligible `POST` / `PUT` / `PATCH` / `DELETE` traffic to Spring via `proxy*RequestToBackend` helpers and the canonical route list in `src/lib/bff-proxy-routes.ts`.

**Corollary:** Do not add new Next route handlers that call the Mongo driver for those product writes outside `src/modules/**` and the documented ESLint allowlists.

## What “active BFF” means

- `ATXFINANCE_BACKEND_ORIGIN` points at the **Spring** service URL (not the Next public URL).
- `shouldProxyAdminUsersToBackend()` is true (staging/prod-shaped; local `next dev` + loopback skips proxy by design so auth and Mongo stay aligned).

## Intentional Next + Mongo (not drift)

Some routes remain **deliberately** on Next + Mongo even though they appear in the BFF parity inventory or share DTOs with Spring. Examples today (see `src/lib/backend-bff.ts`):

- **Personas** — governance and persona store stay on Next to avoid JVM/Next divergence.
- **Admin scheduled tasks** — tenant task orchestration stays on Next.
- **App-user watchlist `GET`/`POST`** and **admin portfolio watchlist `GET`** — richer reads and admin desk parity stay on Next; **app-user watchlist `PATCH`**, **`PATCH` admin portfolio watchlist**, **admin access-requests**, and **admin delivery-channels** (including test POST) go through Spring when the BFF gate is on.
- **xChat** — ask, logging, and xAI tool loop stay **Next-only for now**; optional JVM SSE exists behind an explicit flag only.

These are **policy choices**, not exceptions to sneak around the rule.

## How we report “health”

The admin **Data ownership health** card (home hub) is a **static inventory**: among HTTP **write** rows registered for BFF parity, what share would hit Spring when the gate is on vs which are documented Next-owned. It is **not** live request-volume metrics; add Datadog/log-based dashboards later if we need traffic %.

## References

- `atx-docs/sre-ops/mongo-next-write-boundary.md`
- `atx-docs/architecture/adr-002-read-facade-and-next-mongo-reads.md`
- `src/lib/backend-bff.ts`, `src/lib/data-plane-write-health.ts`
