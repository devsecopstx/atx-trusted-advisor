# Redis cache (Next.js) — PLAN 600

**Kotlin / Spring (Memorystore, PKCE, auth RL, strategy quota):** [spring-redis-memorystore.md](./spring-redis-memorystore.md).

## Reviewer implementation plan (phased)

1. **Scope:** Optional server-side Redis for the Next.js Cloud Run service only (`src/lib/redis-client.ts`, watchlist Yahoo batch path, `/api/health`). Spring/Kotlin Memorystore remains a separate track.
2. **Secrets:** Never commit credentials. Use **`REDIS_URL`** (`redis://` or **`rediss://`** for TLS) in local `.env` and **GCP Secret Manager** for stage/prod. GitHub stays **OIDC-only** for deploy (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`); do **not** store `REDIS_URL` in GitHub Secrets.
3. **Deploy:** Workflows bind **`REDIS_URL=REDIS_URL:latest`** only when a secret named `REDIS_URL` exists in the target GCP project (optional — deploys succeed without it).
4. **First use case:** Short-TTL cache for **`getYahooBatchQuotes`** (sorted symbol set → SHA key, default **30s** TTL) to cut Yahoo load on repeated scanner ticks.
5. **Observability:** `GET /api/health` includes a **`redis`** object: `skipped` | `ok` | `error`.
6. **Tests:** Unit tests for client + cache behavior; integration test for health JSON shape.
7. **Post-startup:** `src/instrumentation.ts` calls `logRedisStartupHealthCheck()` once per Node server process (dev / `next start`); logs `[startup/redis] ok …` or `skipped` / `unhealthy`.
7. **Follow-ups (not in v1):** Spring Redis for rate limits / PKCE (`auth-oauth-spring-dual-run.md`), VPC Memorystore, cache size caps, metrics.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | No | Backward-compatible single URL used by both planes when split vars are unset. |
| `REDIS_URL_CONTROL` / `REDIS_CONTROL_URL` | No | **Control plane** URL for distributed rate limits + rental concurrency + tenant-ux policy cache. Falls back to `REDIS_URL`. |
| `REDIS_URL_CACHE` / `REDIS_CACHE_URL` | No | **Cache plane** URL for market quote, logo, lexical RAG, and workspace snapshot caches. Falls back to `REDIS_URL`. |
| `REDIS_TLS` | No | Set to **`false`**, **`0`**, **`off`**, or **`no`** to treat a `rediss://` URL as **plain** `redis://` (fixes TLS parse errors when the port is not actually TLS). |
| `REDIS_CONNECT_TIMEOUT_MS` | No | Connect timeout for each plane client (100–10000; default 750). |
| `REDIS_QUOTE_CACHE_TTL_SECONDS` | No | **Only** Yahoo batch quote cache TTL in seconds (clamped **5–3600**, default **30**). Does **not** affect connection or TLS. |
| `REDIS_ALLOW_MULTI_DB` | No | When **`1`** / **`true`** / **`yes`**, keep non-zero **`/N`** DB path in Redis URLs. Default: coerce **`/N` → `/0`** (managed Redis often allows only DB 0). |
| `REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS` | No | xChat **full workspace snapshot** JSON TTL (clamped **30–900**, default **120**). Keys: `buildWorkspaceSnapshotCacheKey` in `src/modules/xchat/workspace-snapshot-cache.ts`. Invalidated via `workspaceContentRev` bump on book writes. See [mongo-indexing-guide.md](./mongo-indexing-guide.md) §7.5. |

## Troubleshooting: `ERR DB index is out of range`

Many managed Redis plans (**Redis Cloud Essentials**, serverless caps) only expose **logical database `0`**. URLs ending in **`/1`**, **`/2`**, … then fail at connect with **`ERR DB index is out of range`**.

atxFinance separates **control** vs **cache** by **key prefix** in Redis, not by DB index. The Next client **`normalizeRedisUrlDatabaseToZero`** (used from **`getRedisConnectionUrlForPlane`**) coerces any URL path **`/N` where N > 0** to **`/0`** unless you set **`REDIS_ALLOW_MULTI_DB=1`** (or `true`/`yes`) to keep multi-DB URLs for self-hosted Redis.

You can also fix `.env` / Secret Manager values to use **`…/0`** (or omit the path) for every plane.

## Troubleshooting: `packet length too long` / `tls_get_more_records`

The Node client was using **`rediss://`** (TLS) but the host/port speaks **plain Redis** (same as `redis-cli -u redis://…`). Use **`redis://`** in `REDIS_URL`, or rely on the app’s automatic **rediss → redis retry** when it detects this OpenSSL error.

## Redis Cloud example (TLS)

Your host `redis-….cloud.redislabs.com:14617` typically needs:

```bash
# .env (local) — use URL-encoded password if it contains special characters
REDIS_URL=rediss://default:YOUR_PASSWORD@redis-14617.c52.us-east-1-4.ec2.cloud.redislabs.com:14617
```

Create the GCP secret (staging or prod project):

```bash
printf '%s' 'rediss://default:YOUR_PASSWORD@redis-14617.c52.us-east-1-4.ec2.cloud.redislabs.com:14617' | \
  gcloud secrets create REDIS_URL --data-file=- --project=YOUR_PROJECT_ID
# or add a new version:
printf '%s' 'rediss://...' | gcloud secrets versions add REDIS_URL --data-file=- --project=YOUR_PROJECT_ID
```

Grant the Cloud Run runtime service account **Secret Manager Secret Accessor** on `REDIS_URL`, then redeploy (workflow auto-binds when the secret exists).

## Plane split strategy (HNWI-safe default)

- **Control plane keys**: `ratelimit:*`, `xf:rental-ai:inflight:*`, `tenant-ux:policy:v2:*`
- **Cache plane keys**: `xchat:market_quote:*`, `xf:yahoo:batch:v1:*`, `xf:equity:logo:*`, `xf:wsnap:v1:*`, `xf:rag:lexical:*`
- Keep these on separate Redis instances (or at least DB indexes + ACL users) so cache churn cannot starve control-path reliability.
- **Connection budget:** When both planes use the same `REDIS_URL`, Next keeps **one** `node-redis` client per Node process (`clientsByResolvedUrl` in `src/lib/redis-client.ts`). Do not mount `REDIS_URL_CONTROL` / `REDIS_URL_CACHE` to the same subscription unless you intend two TCP clients per instance.

## TTL policy (v1)

- **Key prefix:** `xf:yahoo:batch:v1:<sha256-prefix>` (symbols uppercased, sorted, deduped).
- **TTL:** `REDIS_QUOTE_CACHE_TTL_SECONDS` or 30s default.
- **Invalidation:** Expiry only (no cross-instance purge).

## Workspace snapshot (xChat)

- **Purpose:** Cache serialized workspace preload (accounts, positions preview, watchlist) for **`loadWorkspaceSnapshotPreload`**.
- **Keys:** `xf:wsnap:v1:<tenant|_>:<userId>:<portfolioHex>:<workspaceContentRev>` — rev bump on portfolio write invalidates without Redis deletes.
- **Env:** `REDIS_WORKSPACE_SNAPSHOT_TTL_SECONDS` (30–900; try **30–60** when Redis/TLS is healthy and Mongo snapshot cost matters).
- **Docs:** [mongo-indexing-guide.md](./mongo-indexing-guide.md) §7.5.

## Tenant UX policy (`tenant_ux`)

- **Purpose:** Cross-instance reuse of resolved route visibility + landing for **`GET /api/internal/tenant-ux/policy`** (`getCachedTenantUxPolicyForSession`).
- **Keys:** `tenant-ux:policy:v2:<userId>:<tenantId>` (JSON payload mirroring **`CachedTenantUxPolicy`**).
- **TTL:** **60s** (`POLICY_TTL_SECONDS` in **`src/modules/platform/tenant-ux-policy-cache.ts`**). Same TTL applies to the in-memory tier; Redis extends freshness across Cloud Run instances when **`REDIS_URL`** is set.
- **Operational:** Dev and production Next deployments mount **`REDIS_URL`** from env / Secret Manager — policy cache **does** use Redis there. On Redis read/write errors the module falls back to memory + Mongo (warns **`[tenant-ux] redis read failed`** / **`redis write failed`**).
- **Invalidation:** **TTL** plus **explicit bust** on **`tenant_roles`** / route-catalog **`PATCH`** and **`POST /api/admin/tenants/{tenantId}/policy-cache`** (`bustTenantUxPolicyCacheForTenant` — pattern **`tenant-ux:policy:v2:*:{tenantId}`** + memory sweep). See [tenant-ux-enforcement.md](./tenant-ux-enforcement.md).
- **Runbook:** [tenant-ux-enforcement.md](./tenant-ux-enforcement.md).

## GitHub

- **No** new GitHub Secrets for Redis.
- Optional: add **`REDIS_QUOTE_CACHE_TTL_SECONDS`** to deploy `--set-env-vars` later if you want per-environment tuning without Secret Manager; v1 uses instance env or default.

## Ops: push Redis secrets to Secret Manager

From a repo-root env file (`.env.stage` / `.env.prod`) that sets **`GOOGLE_PROJECT_ID`** (or **`GOOGLE_CLOUD_PROJECT`** / **`GCP_PROJECT_ID`**) and one or more of **`REDIS_URL`**, **`REDIS_URL_CONTROL`**, **`REDIS_URL_CACHE`**:

```bash
npm run ops:secrets:sync-redis:staging   # → sync-redis-url-secret.sh .env.stage
npm run ops:secrets:sync-redis:prod      # → sync-redis-url-secret.sh .env.prod
```

Each non-empty variable gets its own secret (`REDIS_URL`, `REDIS_URL_CONTROL`, `REDIS_URL_CACHE`). Deploy scripts and GitHub Actions bind **`REDIS_URL_CONTROL`** / **`REDIS_URL_CACHE`** when those secrets exist in the project (see **`deploy-cloud-run-from-env.sh`**).
