# GCP production — two-service model (mirror staging)

**Goal:** One **Next.js** Cloud Run service and one **Spring (`atxfinance-backend`)** Cloud Run service in GCP project **`fintech-advisor-prod`**, same pattern as staging.

**Primary deploy path:** **`gcloud` + repo root `.env.prod`** — **`scripts/ops/deploy-cloud-run-from-env.sh`** (see **`atx-docs/guides/deploy-and-ops.md`**). You do **not** need GitHub Actions or GitHub repository variables to ship prod if you use this script.

## Canonical names

| Layer | Staging | Production |
|--------|---------|------------|
| **GCP project** | `fintech-advisor-staging` | **`fintech-advisor-prod`** |
| **Next.js frontend** (CLI: **`deploy-cloud-run-from-env.sh`**) | `xfinance-core-staging` | **`fintech-advisor-prod`** |
| **Spring backend** (BFF / strategy jobs) | `atxfinance-backend-staging` | **`atxfinance-backend-prod`** |

**Naming note:** In production, the **GCP project id** and the **Next Cloud Run service name** are both **`fintech-advisor-prod`** — different resource types, same string. **`fintech-advisor-prod`** is the live **frontend Next.js** app (serves **`PROD_BASE_URL`** / custom domain). Do not confuse it with the Spring service **`atxfinance-backend-prod`**.

**Do not** point **`ATXFINANCE_BACKEND_ORIGIN`** at the Next public URL (`PROD_BASE_URL` / custom domain). It must be the **Spring** service `https://…run.app` origin. The deploy script **fails** if backend origin equals **`PROD_BASE_URL`**.

**Doc drift:** Older runbooks referenced **`xfinance-core-prod`** as the prod Next service name. That service is **not** deployed in **`fintech-advisor-prod`** today (only **`fintech-advisor-prod`** + **`atxfinance-backend-prod`**). Set **`CLOUD_RUN_SERVICE_PROD=fintech-advisor-prod`** in **`.env.prod`** and GitHub vars.

---

## Recommended Cloud Run capacity (production baseline)

Operator-chosen defaults for **prod** (May 2026, Redis-budget profile). Apply in **GCP Console → Cloud Run → service → Edit & deploy new revision**, or mirror with `gcloud run deploy` / `gcloud run services update`. **Production** Next deploys (**`deploy-cloud-run-from-env.sh`**, **`Deploy Cloud Run`**, **`Deploy Cloud Run Production`**) now default to **`--min-instances=1`** and **`--max-instances=12`**; **`deploy-atxfinance-backend-production.sh`** now defaults to **`--min-instances=1`** and **`--max-instances=8`**. CPU, memory, concurrency, and CPU boost are still **not** set by those commands unless you add flags — a deploy that omits them **leaves existing values**; set capacity in Console when you need explicit control.

### Frontend — Next.js (`fintech-advisor-prod`)

| Setting | Value | Notes |
|---------|-------|--------|
| CPU | **1** (`1000m`) | SSR + streaming |
| Memory | **1Gi** | Safer than 512Mi for Apex charts + large payloads |
| Max concurrent requests per instance | **100** | `containerConcurrency` |
| Min instances | **1** | Warm instance; fewer cold starts for HNWI-style traffic |
| Max instances | **12** | Redis-budget profile (shared plan cap) |
| CPU boost | **On** | `gcloud … --cpu-boost` — extra CPU during **container startup** (cold starts) |
| Startup CPU boost | **On** | Same capability in Console wording; align with **CPU boost** / `--cpu-boost` |

**Example `gcloud`:**

```bash
gcloud run services update fintech-advisor-prod \
  --project fintech-advisor-prod --region us-central1 \
  --cpu=1 --memory=1Gi --concurrency=100 \
  --min-instances=1 --max-instances=12 \
  --cpu-boost --quiet
```

**Confirm live capacity (prod Next frontend):**

```bash
gcloud run services describe fintech-advisor-prod \
  --project fintech-advisor-prod --region us-central1 \
  --format='yaml(spec.template.spec.containers[0].resources,spec.template.spec.containerConcurrency,spec.template.metadata.annotations)'
```

**Expected (verified Jun 2026):** `cpu: '1'`, `memory: 1Gi`, `containerConcurrency: 100`, annotations `autoscaling.knative.dev/minScale: "1"`, `autoscaling.knative.dev/maxScale: "12"`, `run.googleapis.com/startup-cpu-boost: "true"`.

### Security posture (prod — Jul 2026)

| Control | Expected |
|---------|----------|
| `ALLOW_ANY_X_USER_LOGIN` | **`false`** (plain env) — access-request gate |
| Desk SMTP | **Secret Manager** mounts (`SMTP_*`, `DESK_EMAIL_FROM`) — never plaintext `SMTP_PASS` on the revision |
| Next runtime SA | **`fintech-advisor-runtime@fintech-advisor-prod.iam.gserviceaccount.com`** (+ `roles/secretmanager.secretAccessor`) |
| Spring runtime SA | **`atxfinance-backend-app@fintech-advisor-prod.iam.gserviceaccount.com`** (+ `roles/secretmanager.secretAccessor`) |
| WIF OIDC condition | `devsecopstx/atx-trusted-advisor` **or** legacy `devsecopstx/xfinance` |
| Deploy scripts | `deploy-cloud-run-from-env.sh` prefers GSM SMTP; prod defaults Next SA above; backend prod script sets Spring SA |

**SMTP password rotation cutover (after plaintext exposure remediation):**

1. Rotated password is in **`.env.prod`** (`SMTP_PASS`) and GSM version **4** (**disabled**). Live Cloud Run uses an enabled tip that still matches the **current** mail-host password (re-published after the disabled-latest trap).
2. Update the password at **mail.b.hostedemail.com** (or your SMTP provider) to match `.env.prod`.
3. Sync or enable: `bash scripts/ops/sync-desk-smtp-secrets-from-env.sh .env.prod` (preferred) **or** `gcloud secrets versions enable 4 --secret=SMTP_PASS --project=fintech-advisor-prod`.
4. Remount: `gcloud run services update fintech-advisor-prod --region=us-central1 --project=fintech-advisor-prod --update-secrets=SMTP_PASS=SMTP_PASS:latest` (or redeploy Next).

**Not yet done (follow-ups):** lock Spring to authenticated invokers only; reduce **`roles/editor`** on the default compute SA; enable GitHub **secret scanning** (requires Advanced Security on this private repo).

### Backend — Spring (`atxfinance-backend-prod`)

| Setting | Value | Notes |
|---------|-------|--------|
| CPU | **1** (`1000m`) | |
| Memory | **1Gi** | Bump to **2Gi** only if you see OOM on heavy strategy jobs |
| Max concurrent requests per instance | **80** | I/O + Mongo |
| Min instances | **1** | Warm floor for BFF latency to Next and strategy jobs |
| Max instances | **8** | Redis-budget profile (shared plan cap) |
| CPU boost | **On** | `--cpu-boost` |
| Startup CPU boost | **On** | Same as frontend |

**Example `gcloud`:**

```bash
gcloud run services update atxfinance-backend-prod \
  --project fintech-advisor-prod --region us-central1 \
  --cpu=1 --memory=1Gi --concurrency=80 \
  --min-instances=1 --max-instances=8 \
  --cpu-boost --quiet
```

**Inspect any service:**

```bash
gcloud run services describe SERVICE_NAME \
  --project fintech-advisor-prod --region us-central1 \
  --format='yaml(spec.template.spec.containers[0].resources,spec.template.spec.containerConcurrency,spec.template.metadata.annotations)'
```

---

## 1. Configure **`.env.prod`** (source of truth for CLI deploy)

Keep **`.env.prod` gitignored**; set at least:

| Variable | Example / rule |
|----------|----------------|
| **`GCP_PROJECT_ID`** or **`GOOGLE_PROJECT_ID`** | `fintech-advisor-prod` |
| **`CLOUD_RUN_REGION`** | `us-central1` |
| **`CLOUD_RUN_SERVICE_PROD`** | **`fintech-advisor-prod`** (Next frontend) |
| **`PROD_BASE_URL`** | `https://fintech-advisor.ai` (no trailing slash) |
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
export CLOUD_RUN_SERVICE_PROD=fintech-advisor-prod
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

## 3. Custom domain → **`fintech-advisor-prod`** (Next frontend)

In **GCP Console → Cloud Run → Domain mappings** (or your HTTPS load balancer):

- **`PROD_BASE_URL`** must route to **`fintech-advisor-prod`** (the Next.js Cloud Run service).

Verify:

```bash
curl -sS "$PROD_BASE_URL/api/health" | jq .version
curl -sS "$(gcloud run services describe fintech-advisor-prod --project fintech-advisor-prod --region us-central1 --format='value(status.url)')/api/health" | jq .version
```

The **`version`** values should match after DNS/LB propagation.

See also **`.cursor/agents/sre.md`** (routing / wrong service).

---

## 4. Staging cleanup (optional)

Same idea: keep **`xfinance-core-staging`** + **`atxfinance-backend-staging`**; retire unused duplicate Next services when nothing points at them.

---

## Optional: GitHub Actions

If you **also** run **Deploy Cloud Run Production** in GitHub, keep **repository or environment variables** aligned with **`.env.prod`** (`CLOUD_RUN_SERVICE_PROD=fintech-advisor-prod`, `PROD_BASE_URL`, `ATXFINANCE_BACKEND_ORIGIN`) so CI deploys do not fight manual CLI deploys. **CLI-only operators can ignore GitHub vars** as long as they do not use those workflows.

---

## Code reference (canonical names)

TypeScript constants (guarded by **`tests/unit/gcp-prod-cloud-run-names.test.ts`**): **`src/lib/gcp-prod-cloud-run-names.ts`** — **`GCP_PROD_NEXT_SERVICE_NAME`** = **`fintech-advisor-prod`**.

## Related

- **`scripts/ops/deploy-cloud-run-from-env.sh`** — Next Cloud Run deploy from `.env.prod` / `.env.stage`.
- **`scripts/ops/set-atxfinance-backend-origin.sh`** — sets **`ATXFINANCE_BACKEND_ORIGIN`** on the Next service only.
- **`atx-docs/guides/deploy-and-ops.md`** — deploy entrypoint.
- **`atx-docs/sre-ops/api-consolidation-spring-backend.md`** — BFF contract.
- **`atx-docs/sre-ops/atxfinance-backend-http-api.md`** — Spring routes and health paths.
