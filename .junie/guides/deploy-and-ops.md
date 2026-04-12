# Deploy and ops (Cloud Run)

Overview:
- Two services: Next (frontend+BFF) and Spring backend.
- Deploy scripts live under `scripts/ops/*` and docs in `atx-docs/guides/deploy-and-ops.md`.

Preflight:
- Verify secrets against target project:
  - Staging: `npm run ops:secrets:verify:staging`
  - Production: `npm run ops:secrets:verify:prod`
  - Add flags for Google OAuth / Desk SMTP as needed (see package scripts).
- Confirm `ATXFINANCE_BACKEND_ORIGIN` is set where required (BFF routing).

Deploy:
- Staging (Next + backend): `npm run ops:deploy:full:staging`
- Production (Next + backend): `npm run ops:deploy:full:production`
- Backend only (prod): `npm run ops:deploy:atxfinance-backend:production`

Post-deploy checks:
- Health: `npm run ops:validate:prod-stack-health -- .env.prod`
- Admin UI: `/admin/api-docs` (auth required)
- Public: `/api/openapi` (JSON)

Rollback:
- Use previous image in Cloud Run revisions; re-run deploy script with pinned digest if needed.

References:
- Secrets runbook: `atx-docs/sre-ops/secret-rotation.md`
- Release notes: `atx-docs/sre-ops/release-notes.md`
