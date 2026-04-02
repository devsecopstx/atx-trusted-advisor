# GCP runtime secrets — export and diff vs local `.env`

Use this when rotating keys (e.g. **xAI** `XAI_API_KEY` / `XAI_MANAGEMENT_API_KEY`) or reconciling **production** Secret Manager with a trusted local `.env.prod`.

**Secret names** are defined once in `scripts/ops/gcp-runtime-secrets.inc.sh` (same list as deploy preflight + `verify-gcp-runtime-secrets.sh`).

## Compare local file to GCP (no raw secrets)

Prints `MATCH`, `MISMATCH` (with short SHA-256 fingerprints), or `LOCAL_EMPTY_OR_UNSET`:

```bash
# Prod project defaults to fintech-advisor-prod via package.json
npm run ops:secrets:diff:prod
```

Or explicitly:

```bash
bash scripts/ops/diff-local-env-vs-gcp-secrets.sh \
  --project fintech-advisor-prod \
  --env-file .env.prod
```

Include optional keys when they exist in GCP: **`GOOGLE_CLIENT_ID`**, **`GOOGLE_CLIENT_SECRET`** (see `scripts/ops/gcp-runtime-secrets.inc.sh` → `GCP_RUNTIME_SECRETS_OPTIONAL`).

```bash
npm run ops:secrets:diff:prod:optional
```

## Export GCP latest to a file (SENSITIVE)

Writes `.env.prod.gcp-export` (gitignored via `.env.*`). **Never commit.**

```bash
npm run ops:secrets:export:prod
chmod 600 .env.prod.gcp-export
diff -u .env.prod .env.prod.gcp-export | less
```

Optional Stripe secret in the same file:

```bash
bash scripts/ops/export-gcp-runtime-secrets.sh \
  --project fintech-advisor-prod \
  --output .env.prod.gcp-export \
  --include-optional
```

## Updating xAI keys in GCP

1. Diff to confirm local vs GCP: `npm run ops:secrets:diff:prod`.
2. Put the new key in `.env.prod` (or export from console).
3. Add a new Secret Manager version (see `scripts/ops/rotate-gcp-secrets-and-deploy.sh` or `gcloud secrets versions add`).
4. Redeploy Cloud Run so the service picks up `latest` bindings (or wait for next deploy).

## Prerequisites

- `gcloud` authenticated with `secretmanager.versions.access` on the target project.
- Local path to env file (e.g. `.env.prod`) with the same variable names as GCP secret ids (`XAI_API_KEY`, etc.).
