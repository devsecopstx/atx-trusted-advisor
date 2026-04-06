# GCP production — two-service model (mirror staging)

**Goal:** One **Next.js** Cloud Run service and one **Spring (`atxfinance-backend`)** Cloud Run service in **`fintech-advisor-prod`**, same pattern as staging.

**Primary deploy path:** **`gcloud` + repo root `.env.prod`** — **`scripts/ops/deploy-cloud-run-from-env.sh`** (see **`atx-docs/guides/deploy-and-ops.md`**). You do **not** need GitHub Actions or GitHub repository variables to ship prod if you use this script.

## Canonical names

| Layer | Staging | Production |
|--------|---------|------------|
| Next (CLI: **`deploy-cloud-run-from-env.sh`**) | `xfinance-core-staging` | **`xfinance-core-prod`** |
| Spring (BFF / strategy jobs) | `atxfinance-backend-staging` | **`atxfinance-backend-prod`** |

**Do not** point **`ATXFINANCE_BACKEND_ORIGIN`** at the Next public URL (`PROD_BASE_URL` / custom domain). It must be the **Spring** service `https://…run.app` origin. The deploy script **fails** if backend origin equals **`PROD_BASE_URL`**.

Legacy duplicate Next services (`fintech-advisor-prod`, etc.) should receive **no** traffic after cutover.

---

## 1. Configure **`.env.prod`** (source of truth for CLI deploy)

Keep **`.env.prod` gitignored**; set at least:

| Variable | Example / rule |
|----------|----------------|
| **`GCP_PROJECT_ID`** or **`GOOGLE_PROJECT_ID`** | `fintech-advisor-prod` |
| **`CLOUD_RUN_REGION`** | `us-central1` |
| **`CLOUD_RUN_SERVICE_PROD`** | **`xfinance-core-prod`** |
| **`PROD_BASE_URL`** | `https://atx.fintech-advisor.ai` (no trailing slash) |
| **`ATXFINANCE_BACKEND_ORIGIN`** | **`https://atxfinance-backend-prod-….us-central1.run.app`** (Spring only) |

Then deploy Next from repo root:

```bash
npm run ops:deploy:cloud-run:production
# or with lint/typecheck/tests first:
npm run ops:deploy:cloud-run:production:ci
# equivalent:
bash scripts/ops/deploy-cloud-run-from-env.sh --production
```

**Optional:** update only BFF env on Next without a full image rebuild:

```bash
export GCP_PROJECT_ID_PROD=fintech-advisor-prod
export CLOUD_RUN_SERVICE_PROD=xfinance-core-prod
export CLOUD_RUN_REGION=us-central1
bash scripts/ops/set-atxfinance-backend-origin.sh prod "https://atxfinance-backend-prod-….us-central1.run.app"
```

---

## 2. Create / deploy **`atxfinance-backend-prod`**

**One-shot (recommended):** from repo root, with **`gcloud`** + **Docker** and prod **Secret Manager** populated (same secret **names** as core Next deploy: `MONGODB_URI_B64`, `XAI_API_KEY`, `AUTH_SECRET`, etc.):

```bash
npm run ops:deploy:atxfinance-backend:production
```

Defaults: **`GCP_PROJECT_ID=fintech-advisor-prod`**, **`CLOUD_RUN_REGION=us-central1`**, **`ARTIFACT_REGISTRY_REPO=atxfinance-core-app`** (same Docker repo as Next in **`deploy-cloud-run-production.yml`**), service **`atxfinance-backend-prod`**. Override **`ARTIFACT_REGISTRY_REPO`** if your prod registry uses another name (staging script still defaults to **`cloud-run-images`**).

The script binds **`MONGODB_URI=MONGODB_URI_B64:latest`** (Spring resolves via **`MONGODB_URI`**). If **`REDIS_URL`** exists as a secret in the prod project, it is bound automatically.

**First-time GCP setup (before first deploy):**

1. **Artifact Registry** Docker repo in prod (default **`atxfinance-core-app`** in **`us-central1`**) — create if missing:

   ```bash
   gcloud artifacts repositories describe atxfinance-core-app \
     --project=fintech-advisor-prod --location=us-central1 \
     || gcloud artifacts repositories create atxfinance-core-app \
          --project=fintech-advisor-prod --location=us-central1 \
          --repository-format=docker
   ```
2. **Secret Manager:** create/sync the same keys Next uses for Mongo + xAI + auth (`npm run ops:secrets:verify:prod` helps). Prod Mongo URI must point at the **prod** cluster/DB.
3. Run **`npm run ops:deploy:atxfinance-backend:production`** — creates or updates the Cloud Run service.

**Smoke + wire Next:**

```bash
BACKEND_URL="$(gcloud run services describe atxfinance-backend-prod --project fintech-advisor-prod --region us-central1 --format='value(status.url)')"
curl -sS "${BACKEND_URL}/api/health"
```

Put **`ATXFINANCE_BACKEND_ORIGIN=${BACKEND_URL}`** (no trailing slash) in **`.env.prod`**, then:

```bash
bash scripts/ops/set-atxfinance-backend-origin.sh prod "${BACKEND_URL}"
npm run ops:deploy:cloud-run:production
```

**Validate both layers (latency + HTTP 200):**

```bash
npm run ops:validate:prod-stack-health
```

**Manual image path** (if you are not using the script): repo root **`Dockerfile.backend`**, push to **`${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/atxfinance-backend-prod:<tag>`**, then **`gcloud run deploy atxfinance-backend-prod --image ...`** with the same **`--set-secrets`** as **`deploy-atxfinance-backend-production.sh`**.

**Copy env from staging** when unsure which keys Spring needs:

```bash
gcloud run services describe atxfinance-backend-staging \
  --project fintech-advisor-staging --region us-central1 \
  --format yaml
```

Replicate **secret names** (and prod values) on **`atxfinance-backend-prod`**.

---

## 3. Custom domain → **`xfinance-core-prod`**

In **GCP Console → Cloud Run → Domain mappings** (or your HTTPS load balancer):

- **`PROD_BASE_URL`** must route to **`xfinance-core-prod`**, not `fintech-advisor-prod`.

Verify:

```bash
curl -sS "$PROD_BASE_URL/api/health" | jq .version
curl -sS "$(gcloud run services describe xfinance-core-prod --project fintech-advisor-prod --region us-central1 --format='value(status.url)')/api/health" | jq .version
```

The **`version`** values should match after DNS/LB propagation.

See also **`.cursor/agents/sre.md`** (routing / wrong service).

---

## 4. Retire **`fintech-advisor-prod`** (duplicate Next)

1. Confirm **no** domain mapping and **no** load balancer backend points to it.
2. Confirm traffic is zero (metrics / logs).
3. Delete the service or stop deploying to it:

```bash
gcloud run services delete fintech-advisor-prod --project fintech-advisor-prod --region us-central1
```

(Only after you are sure nothing uses it.)

---

## 5. Staging cleanup (optional)

Same idea: keep **`xfinance-core-staging`** + **`atxfinance-backend-staging`**; retire unused **`fintech-advisor-staging`** / **`xfinance`** when nothing points at them.

---

## Optional: GitHub Actions

If you **also** run **Deploy Cloud Run Production** in GitHub, keep **repository or environment variables** aligned with **`.env.prod`** (`CLOUD_RUN_SERVICE_PROD`, `PROD_BASE_URL`, `ATXFINANCE_BACKEND_ORIGIN`) so CI deploys do not fight manual CLI deploys. **CLI-only operators can ignore GitHub vars** as long as they do not use those workflows.

---

## Related

- **`scripts/ops/deploy-cloud-run-from-env.sh`** — Next Cloud Run deploy from `.env.prod` / `.env.stage`.
- **`scripts/ops/set-atxfinance-backend-origin.sh`** — sets **`ATXFINANCE_BACKEND_ORIGIN`** on the Next service only.
- **`atx-docs/guides/deploy-and-ops.md`** — deploy entrypoint.
- **`atx-docs/sre-ops/api-consolidation-spring-backend.md`** — BFF contract.
- **`atx-docs/sre-ops/atxfinance-backend-http-api.md`** — Spring routes and health paths.
