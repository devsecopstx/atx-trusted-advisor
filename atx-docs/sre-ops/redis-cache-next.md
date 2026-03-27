# Redis cache (Next.js) — PLAN 600

## Reviewer implementation plan (phased)

1. **Scope:** Optional server-side Redis for the Next.js Cloud Run service only (`src/lib/redis-client.ts`, watchlist Yahoo batch path, `/api/health`). Spring/Kotlin Memorystore remains a separate track.
2. **Secrets:** Never commit credentials. Use **`REDIS_URL`** (`redis://` or **`rediss://`** for TLS) in local `.env` and **GCP Secret Manager** for stage/prod. GitHub stays **OIDC-only** for deploy (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`); do **not** store `REDIS_URL` in GitHub Secrets.
3. **Deploy:** Workflows bind **`REDIS_URL=REDIS_URL:latest`** only when a secret named `REDIS_URL` exists in the target GCP project (optional — deploys succeed without it).
4. **First use case:** Short-TTL cache for **`getYahooBatchQuotes`** (sorted symbol set → SHA key, default **30s** TTL) to cut Yahoo load on repeated scanner ticks.
5. **Observability:** `GET /api/health` includes a **`redis`** object: `skipped` | `ok` | `error`.
6. **Tests:** Unit tests for client + cache behavior; integration test for health JSON shape.
7. **Follow-ups (not in v1):** Spring Redis for rate limits / PKCE (`auth-oauth-spring-dual-run.md`), VPC Memorystore, cache size caps, metrics.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REDIS_URL` | No | Full connection URL. Examples: `redis://default:PASSWORD@host:14617` or `rediss://default:PASSWORD@host:14617` (Redis Cloud often requires TLS). |
| `REDIS_QUOTE_CACHE_TTL_SECONDS` | No | Yahoo batch cache TTL in seconds (clamped **5–3600**, default **30**). Safe as a Cloud Run **literal env** (non-secret). |

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

## TTL policy (v1)

- **Key prefix:** `xf:yahoo:batch:v1:<sha256-prefix>` (symbols uppercased, sorted, deduped).
- **TTL:** `REDIS_QUOTE_CACHE_TTL_SECONDS` or 30s default.
- **Invalidation:** Expiry only (no cross-instance purge).

## GitHub

- **No** new GitHub Secrets for Redis.
- Optional: add **`REDIS_QUOTE_CACHE_TTL_SECONDS`** to deploy `--set-env-vars` later if you want per-environment tuning without Secret Manager; v1 uses instance env or default.
