# BFF Enable — Staging Runbook

Enable the Next.js BFF proxy to atxfinance-backend (Spring) in staging. Product API traffic flows: **browser → Next (same-origin) → Spring**.

**Prerequisite:** Same Mongo, same `AUTH_SECRET` / `X_OAUTH_CLIENT_SECRET` for session cookie parity.

---

## 1. Deploy backend to staging

```bash
# From repo root; requires gcloud auth, docker, Artifact Registry + Cloud Run permissions
./scripts/ops/deploy-atxfinance-backend-staging.sh
```

**Overrides:** `GCP_PROJECT_ID`, `CLOUD_RUN_REGION`, `ARTIFACT_REGISTRY_REPO`, `ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE` (default: `atxfinance-backend-staging`).

The script builds `Dockerfile.backend`, pushes to Artifact Registry, deploys to Cloud Run, and prints the backend URL + a health-check curl. If deploy fails, fix backend build/Mongo secrets before proceeding.

---

## 2. Verify backend is healthy

```bash
export GCP_PROJECT_ID="${GCP_PROJECT_ID:-fintech-advisor-staging}"
export CLOUD_RUN_REGION="${CLOUD_RUN_REGION:-us-central1}"
export BACKEND_SVC="${ATXFINANCE_BACKEND_CLOUD_RUN_SERVICE:-atxfinance-backend-staging}"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SVC" \
  --project "$GCP_PROJECT_ID" \
  --region "$CLOUD_RUN_REGION" \
  --format='value(status.url)')

curl -sS "${BACKEND_URL}/api/health" | head -c 200
```

**Expected:** JSON with `status` / `ok` or similar.

---

## 3. Set ATXFINANCE_BACKEND_ORIGIN on the frontend (Next.js) Cloud Run

```bash
# Assumes BACKEND_URL from step 2 (or re-run the describe + curl block)
./scripts/ops/set-atxfinance-backend-origin.sh staging "$BACKEND_URL"
```

**Persist across deploys:** Add `ATXFINANCE_BACKEND_ORIGIN` to GitHub → Settings → Environments → staging → Environment variables (value = backend URL). The deploy workflow passes it through so it survives redeploys.

**Defaults:** `CLOUD_RUN_SERVICE_STAGING=xfinance-core-staging`, `GCP_PROJECT_ID=fintech-advisor-staging`, `CLOUD_RUN_REGION=us-central1`.

---

## 4. Verify BFF proxy

1. Log in to staging (Next OAuth callback still on Next).
2. Open a BFF-proxied surface: Portfolios, Admin → Users, Admin → Tasks, etc.
3. Check Cloud Run logs for the **frontend** service — requests should hit Spring; check backend logs for same.

```bash
# Quick smoke: with a valid session cookie, call a proxied route
curl -b "xf_core_session=<valid-cookie>" "https://staging.atx.fintech-advisor.ai/api/portfolios/current"
```

---

## 5. Enable Spring auth callback (optional, after BFF verified)

When BFF is healthy, route OAuth callback to Spring:

```bash
gcloud run services update xfinance-core-staging \
  --project fintech-advisor-staging \
  --region us-central1 \
  --update-env-vars "AUTH_CALLBACK_USE_SPRING=true" \
  --quiet
```

**Persist across deploys:** Add `AUTH_CALLBACK_USE_SPRING=true` to GitHub → Settings → Environments → staging → Environment variables. The deploy workflow passes it through (default `false` if unset).

**Rollback (revert to Next callback):**

```bash
gcloud run services update xfinance-core-staging \
  --project fintech-advisor-staging \
  --region us-central1 \
  --remove-env-vars AUTH_CALLBACK_USE_SPRING \
  --quiet
```

---

## 6. Soak (7–14 days when auth cutover enabled)

- [ ] Compare login success rate: Next callback vs Spring callback (Cloud Run logs).
- [ ] Watch for `[auth/x/callback]` errors: `invalid_oauth_state`, `token_exchange_failed`, `bootstrap_failed`.
- [ ] Spot-check: new user flow, existing user flow, placeholder-email → link-email flow.
- [ ] Align login UI copy for any new error aliases.

---

## 7. Cutover (when ready to retire Next callback)

1. [ ] Soak complete; no regressions.
2. [ ] Remove Next callback fallback: delete `AUTH_CALLBACK_USE_SPRING` check; proxy is the sole path when `ATXFINANCE_BACKEND_ORIGIN` is set.
3. [ ] Remove Next `/api/auth/x/callback` route handler (or leave as 301 redirect to Spring if LB semantics differ).
4. [ ] Update [auth-oauth-spring-dual-run.md](./auth-oauth-spring-dual-run.md): Spring is authoritative.

---

## Rollback (disable BFF)

```bash
gcloud run services update xfinance-core-staging \
  --project fintech-advisor-staging \
  --region us-central1 \
  --remove-env-vars ATXFINANCE_BACKEND_ORIGIN
```

Next route handlers will execute Mongo fallbacks again.

---

## Related

- [api-consolidation-spring-backend.md](./api-consolidation-spring-backend.md) — BFF topology, PR 3/4 cutover
- [auth-oauth-spring-dual-run.md](./auth-oauth-spring-dual-run.md) — Auth cutover; Spring callback implemented, enable via `AUTH_CALLBACK_USE_SPRING=true`
