# Production deploy checklist (atxFinance core app)

Use this with **Deploy Cloud Run** (`workflow_dispatch`, `confirm_manual_approval=yes`) and environment protection on **staging** / **production**.

## Gates (must be green on the release ref)

1. **`npm run ci:gate`** — lint, typecheck, **`docs:links`** (all `atx-docs/**/*.md`), OpenAPI parity tests, Vitest (unit + integration).
2. **`NODE_ENV=production npm run build`** — Next compile + SSG.
3. If **`services/atxfinance-backend/**` changed:** `./gradlew test` from that directory.
4. **Version:** root `package.json` / `package-lock.json` `packages[""].version` match intended tag; `APP_VERSION` is read from `package.json` via `src/lib/app-version.ts` (no separate hardcoded constant).
5. **Billing/workspace defaults parity (when billing/workspace code changes):**
   - Open `/admin/tenant-preferences/workspace-limits?tenant=<targetTenantId>` and confirm intended `workspaceLimits` + `planOverrides`.
   - Open `/account/billing` (guest and signed-in) and confirm plan cards show matching quota rows and list prices for that tenant default.

## Secrets and configuration (do not mix layers)

| Layer | What belongs there |
| --- | --- |
| **GitHub Actions — repository / environment Secrets** | **OIDC only:** `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL` (see `.env.example` § *Deploy identity*). |
| **GitHub Environments — Variables** | `GCP_PROJECT_ID_*`, `CLOUD_RUN_*`, `STAGING_BASE_URL`, `PROD_BASE_URL`, `EXPECTED_GITHUB_*`, non-sensitive app config (e.g. `NEXT_PUBLIC_*`, Stripe publishable key pattern per `stripe-billing-setup.md`). |
| **GCP Secret Manager** | Runtime app secrets mounted by deploy workflows: `MONGODB_URI` / `MONGODB_URI_B64`, `XAI_*`, `X_OAUTH_*`, `AUTH_SECRET`, `SLACK_WEBHOOK_URL`, `STRIPE_SECRET_KEY`, `REDIS_URL`, etc. Update via **`scripts/ops/rotate-gcp-secrets-and-deploy.sh`** (see **`secret-rotation.md`**). |

**Do not** copy Mongo, xAI, or OAuth client secrets into GitHub Actions secrets unless you have an explicit exception documented with security review — the repo standard is **OIDC to GCP + Secret Manager**.

### Updating GitHub OIDC secrets after rotation

When the workload identity provider or deploy service account changes:

```bash
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER -b"<full provider resource name>" -R <owner>/<repo>
gh secret set GCP_SERVICE_ACCOUNT_EMAIL -b"<sa@project.iam.gserviceaccount.com>" -R <owner>/<repo>
```

Use **staging** first; confirm **Deploy Cloud Run** can still read Secret Manager and deploy.

## RAG / disk content (`atx-docs/rag-collection`)

- **Canonical tree:** `atx-docs/rag-collection/` (legacy `atx-rag-collection/` at repo root is still a fallback in ingest scripts).
- **Layout + path comments:** covered by **`tests/unit/atx-rag-collection-layout.test.ts`** — run via `npm run test`.
- **Post-deploy:** new or edited Markdown/PDF under `rag-collection/` is **not** live in xAI until an operator runs **`npm run seed:admin`** (or targeted `verify:xai-seed-rag` / ingest steps) against the target environment with management keys — document in the deploy note if a content refresh is required.

## Related runbooks

- **`secret-rotation.md`** — credential rotation
- **`redis-cache-next.md`** — `REDIS_URL` / health
- **`x-oauth-atx-callbacks.md`** — OAuth host consistency
- **`AGENTS.md`** (repo root) — health checks and app_user validation after deploy
