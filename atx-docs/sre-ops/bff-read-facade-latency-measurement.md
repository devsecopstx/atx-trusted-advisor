# BFF read facade — latency measurement (50–80 ms budget)

**Goal:** Quantify the **extra hop** when the browser calls Next and Next proxies to **Spring** for read facades / portfolio APIs, so product shell pages stay snappy.

**Budget (aggregate server-side, not LCP):** added latency from **BFF proxy path** vs **Next Mongo fallback** on the same route should typically stay **under 50–80 ms p95** per logical read once warm (same region, Memorystore hot). Cold starts and cross-region setups are out of scope for this number.

## What to measure

1. **Spring handler time** — response headers from JVM:
   - `GET /api/portfolios/{id}/snapshot`: **`X-Atx-Snapshot-Handler-Ms`**
   - `GET /api/read/product-shell-v1`: **`X-Atx-Read-Facade-Total-Ms`**, **`X-Atx-Read-Facade-Default-Ms`**, **`X-Atx-Read-Facade-Snapshot-Ms`**
2. **Next overhead** — difference between:
   - `curl -w '%{time_total}\n' -o /dev/null -s` to **`https://<next>/api/read/product-shell-v1`** (session cookie), and  
   - same cookie to **`https://<spring>/api/read/product-shell-v1`** (direct JVM, if reachable from operator laptop / Cloud Shell).  
   Subtract to approximate **Next proxy + network leg** inside GCP.

## Top five product pages (shell + data)

| Page | Primary read APIs today (indicative) | Facade note |
|------|----------------------------------------|-------------|
| `/xchat` | default portfolio, workspace snapshot / warm | Prefer **`GET /api/read/product-shell-v1`** once client wired. |
| `/watchlist` | watchlist `GET` + portfolio scope | Watchlist still often Next-Mongo until BFF flag flips. |
| `/portfolio` | portfolios, accounts, positions | Mostly BFF-proxied when origin set. |
| `/xoptions` | find-options bootstrap, entitlements | Bootstrap still Next-only — measure separately. |
| `/admin` (hub) | bootstrap, audit, users directory | Mixed; several admin GETs stay Next-only when BFF on. |

## Lighthouse (Chrome DevTools)

1. Open staging, sign in, **Clear site data** once, then reload target route **twice** (warm).
2. **Lighthouse** → Performance → **Network RTT** / **Server backend time** in trace; compare **before/after** enabling client use of read facade (same build, feature flag if used).
3. Record **LCP** and **TTFB** — goal is **no regression > ~80 ms median** on same hardware/network; document outliers (cold start, first Redis miss).

## Pass criteria (operational)

- JVM **`X-Atx-Read-Facade-Total-Ms`** p95 **< 80 ms** with `includeSnapshot=true` on a tenant with a materialized snapshot row (Redis hit after warm).
- Next→Spring incremental (`curl` delta) p95 **< 50 ms** same region.

## References

- ADR: **`atx-docs/architecture/adr-002-read-facade-and-next-mongo-reads.md`**
- Read plane: **`atx-docs/sre-ops/spring-read-plane-and-mongo-exit.md`**
