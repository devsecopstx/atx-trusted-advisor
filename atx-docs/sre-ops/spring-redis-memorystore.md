# Spring / Kotlin Redis (Memorystore) — PLAN 600

**Sibling:** Next.js optional Redis (quotes + health) — [redis-cache-next.md](./redis-cache-next.md).

## When it activates

If **`REDIS_URL`** / **`REDIS_URL_CONTROL`** / **`REDIS_URL_CACHE`** (or Spring URL variants) is set to a `redis://` or `rediss://` URL, the backend enables:

| Feature | Behavior |
|--------|----------|
| **Lettuce connections** | `AtxRedisConfiguration` — **one** pooled connection per JVM by default (`REDIS_POOL_MAX_ACTIVE=1`); control + cache templates share the same factory when URLs match. |
| **OAuth PKCE** | `OAuthPkceRedisStore` — key `xf:oauth:pkce:{state}`, TTL `OAUTH_PKCE_REDIS_TTL_SECONDS` (default **600**). `GET /api/auth/x/login` writes verifier; `GET /api/auth/x/callback` consumes it if cookies are missing. |
| **Auth rate limits** | `AuthPathRateLimitFilter` — per client IP, rolling minute bucket (`X-Forwarded-For` first hop). Defaults: login **30**/min, callback **60**/min. Set to **0** to disable a limit. Env: `AUTH_RATE_LIMIT_LOGIN_PER_MINUTE`, `AUTH_RATE_LIMIT_CALLBACK_PER_MINUTE`. |
| **Strategy jobs** | Hourly create cap: Mongo **`rate_limits`** + **`RateLimitService`** (atomic upsert + `$inc`, mirrors Next `xchat_usage_limits`). Failed job insert rolls back the counter. **Redis is not used** for this fuse. |
| **Portfolio workspace snapshot cache** | **`GET /api/portfolios/{portfolioId}/snapshot`** — read-through Redis for materialized xChat preload (`xf:wsnap:v1:*`), with **version-key invalidation** (`xf:wsnap:v1:cv:*`) instead of wildcard key scans. TTL **60s** when US regular session is likely **open** and **300s** when likely **closed** (`PORTFOLIO_SNAPSHOT_TTL_OPEN_SECONDS` / `PORTFOLIO_SNAPSHOT_TTL_CLOSED_SECONDS`). |
| **Health** | `/api/health` and `/api/backend/health` include **`redis`** / `details.redis`: `ok` \| `error` \| `skipped`. |

When **`REDIS_URL` is unset**, none of the above beans load; behavior matches pre-600 JVM (cookies-only OAuth context, Mongo `rate_limits` strategy job hourly cap, no auth filter, no snapshot Redis cache).

## TLS / `rediss://` vs plain

Same operational rule as Next: if the port speaks **plain Redis** but the URL uses **`rediss://`**, set **`REDIS_TLS=false`** (or `app.atxfinance.redis.tls-plain-with-rediss=true`) so the client dials **without** TLS.

## GCP Memorystore

1. Create a **Memorystore for Redis** instance in the **same VPC / connector** as Cloud Run (or use Private Service Connect per your network design).
2. Store the full URL in **Secret Manager** as `REDIS_URL` (same secret name can be mounted on **both** Next and JVM services if product wants shared keyspace — or use separate DB indexes / key prefixes intentionally).
3. Grant the **Cloud Run runtime service account** secret accessor on that secret; bind `REDIS_URL=REDIS_URL:latest` on deploy.

## Configuration reference (`application.yml`)

Under `app.atxfinance.redis`:

- `url` ← `${REDIS_URL:}`
- `control-url` ← `${REDIS_URL_CONTROL:${REDIS_URL:}}`
- `cache-url` ← `${REDIS_URL_CACHE:${REDIS_URL:}}`
- `tls-plain-with-rediss` ← `${REDIS_TLS_PLAIN_WITH_REDISS:false}`
- `command-timeout-ms` ← `${REDIS_COMMAND_TIMEOUT_MS:750}`
- `connect-timeout-ms` ← `${REDIS_CONNECT_TIMEOUT_MS:750}`
- `pool-max-active` / `pool-max-idle` / `pool-min-idle`
- `pool-max-wait-ms`
- `pool-min-evictable-idle-ms`
- `pool-eviction-run-interval-ms`
- `reconnect-backoff-min-ms` / `reconnect-backoff-max-ms`
- `pkce-ttl-seconds` ← `${OAUTH_PKCE_REDIS_TTL_SECONDS:600}`
- `auth-login-limit-per-minute` ← `${AUTH_RATE_LIMIT_LOGIN_PER_MINUTE:30}`
- `auth-callback-limit-per-minute` ← `${AUTH_RATE_LIMIT_CALLBACK_PER_MINUTE:60}`
- `oauth-flow-cookie-max-age-seconds` ← `${OAUTH_FLOW_TTL_SECONDS:1800}`
- `portfolio-snapshot-ttl-open-seconds` ← `${PORTFOLIO_SNAPSHOT_TTL_OPEN_SECONDS:60}`
- `portfolio-snapshot-ttl-closed-seconds` ← `${PORTFOLIO_SNAPSHOT_TTL_CLOSED_SECONDS:300}`

## Deploy note (quota drift)

The Redis strategy-job counter starts at **zero** when first enabled. Until the current hour bucket aligns with Mongo history, operators may temporarily allow more creations than a pure Mongo count would — acceptable for soft limits; tighten with a maintenance window or lower `STRATEGY_MAX_JOBS_HOURLY` during cutover if needed.
