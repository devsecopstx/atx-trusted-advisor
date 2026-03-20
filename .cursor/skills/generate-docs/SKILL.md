---
id: generate-docs
name: generate-docs
description: Update and generate concise, accurate docs for changed systems, APIs, and runbooks.
---

# Generate Docs

## Goal

Keep project documentation aligned with code changes and operational reality.

## Use This Skill When

- Features changed but docs lag behind
- New APIs/workflows need examples
- Runbooks need clearer setup or troubleshooting steps

## Workflow

1. Identify changed behavior and impacted docs.
2. Update existing docs before creating new ones.
3. Add concrete examples, constraints, and failure modes.
4. Keep structure scannable and concise.
5. Validate commands and paths in docs.
6. Keep version references consistent across docs and UI surfaces.

## Baseline Docs Set (xFinance Core)

Default to maintaining this minimum docs set:

- `README.md`: product scope + fast local start.
- `DEVELOPMENT.md`: full setup, required env keys, runbooks, API map.
- `.env.example`: empty `KEY=` lines and required key names only (no credential-shaped placeholders).
- `AGENTS.md`: operator-centric commands/checks and troubleshooting.
- `CONTRIBUTING.md`: local validation + PR quality gates.

When introducing new subsystems, prefer extending `DEVELOPMENT.md` and linking from `README.md` instead of creating scattered top-level docs.

**xChat / branding:** Keep **`docs/xchat/xfinance-branding-review.md`** in sync when **`xfinance-branding.mdc`** or logo/hero/pricing messaging changes materially.

## API docs & OpenAPI (route changes)

When **`src/app/api/**`** or public HTTP contracts change:

- Keep **`DEVELOPMENT.md`** *api-docs-validation* section accurate (inventory build, route parity).
- CI guards OpenAPI via `tests/integration/openapi-*.test.ts` — run **`npm run ci:gate`** (and **`npm run build`** if release-sensitive) before merge.

## xAI tools & collections (external reference)

When documenting persona tools, RAG, or batch behavior for xChat:

- **Collections search** (knowledge bases): upstream docs describe **`collections_search`** in the xAI SDK vs **`file_search`** in OpenAI-compatible Responses API — same capability, different names. See [xAI — Collections Search tool](https://docs.x.ai/developers/tools/collections-search).
- **This codebase** maps persona `collections_search` → `file_search` with `source.collection_ids` in **`src/lib/xai-tools.ts`** (`toXaiRequestTools`). Document that mapping when touching personas or batch payloads so operators are not confused by SDK vs HTTP naming.
- **RAG index stats:** `GET /api/personas/collections` and `GET /api/personas/collections/:collectionId` return documentCount, chunkCount, fileCount, indexStatus when the xAI Management API provides them. Admin RAG console (`/admin/rag-files`) displays these. Update `DEVELOPMENT.md` and OpenAPI inventory when adding or changing collection stats fields.
- **Batch API (canonical upstream):** [xAI — Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api) — create batch → add requests (or **JSONL** upload with `custom_id`, `method`, `url`, `body`) → **poll** status until pending reaches zero → **paginate results**. Processing is typically **async** (often within 24 hours per docs); not a synchronous response from the submit call. **Tool use:** server-side tools run during batch processing; **client-side / function** tools return `tool_calls` in the response — multi-turn requires **new** batch requests with tool results (see doc *Tool Use* section). This repo’s JSONL path uses `src/lib/xai-batch.ts` + `src/modules/xchat/batch-service.ts` with `/v1/responses` or `/v1/chat/completions` per line.

## Branding, investor narrative & xChat product copy

When **positioning, GTM, waitlist, investor deck copy**, or **logo / visual identity** change:

- **Cursor rule (source of truth):** **`.cursor/rules/xfinance-branding.mdc`** — tagline, **aTx⚡Finance** lockup, **$2/hr** lock-in vs roadmap tiers, differentiation, weak-spot honesty, channels, compliance narrative.
- **Expert review doc:** **`docs/xchat/xfinance-branding-review.md`** — logo/hero/design-system alignment with the rule; link or summarize rule updates here when the review doc is the stakeholder-facing explainer.
- Do **not** duplicate conflicting pricing: shipped UI keeps **$2/hr** on primary surfaces; roadmap subscription tiers stay secondary (deck/waitlist) until productized.

## PR review handoff

For combined Core MVP + Branding PRs, the final gate sequence lives in **`xdesign-review`** (reviewer order + production deploy lock). Use this skill for doc/runbook updates; use **`test-commit-push`** for the local validation pass. Post-deploy smoke steps: **`AGENTS.md` → Production validation (post-deploy)**.

## Cursor rules (`.cursor/rules/*.mdc`)

**Gaps to avoid**

- **Patch noise**: rule files must not contain leading `+` lines or duplicate frontmatter blocks (merge artifacts break Cursor parsing).
- **Wrong globs**: paths must match **this** repo (e.g. xChat → `src/app/xchat/**`, `src/app/api/xchat/**`, `src/modules/xchat/**`, `docs/xchat/**` — not other monorepo layouts).
- **Drift**: if a rule references APIs or folders that moved, update the rule in the same PR as the code move.

**When to document**

- New or heavily updated `.mdc` files: add a **one-line pointer** in `DEVELOPMENT.md` or `AGENTS.md` under Cursor / agent setup *if* operators need to discover them; otherwise the rule is self-describing via `description` + `globs`.
- xChat-specific product/agent notes stay in **`docs/xchat/`**; keep rules short and link out.

## Version Consistency Rules

- Canonical app version lives only in `package.json`.
- Runtime surfaces (admin footer, etc.) must resolve via `src/lib/app-version.ts` — no hardcoded version strings in UI or skill files.
- Skill `.md` files must never contain app version literals; a `package.json` version bump must not require touching skills.

## Local Skill Sync

- Keep docs-ops guidance aligned with:
  - `.cursor/skills/test-commit-push/SKILL.md`
  - `.cursor/skills/test-commit-push/CHECKLIST.md`
  - `.cursor/skills/test-automation/SKILL.md` (when adding or scoping tests)
  - `.cursor/skills/xdesign-review/SKILL.md` (combined MVP + branding + pre-prod lock)
  - `AGENTS.md`
- Rule changes under `.cursor/rules/` ship with the same validation pass as skills (see test-commit-push checklist).

## Deploy / secrets doc parity (xFinance)

When `.github/workflows/deploy-cloud-run.yml` changes **which env vars or Secret Manager names** are validated or mounted:

1. Update **`DEVELOPMENT.md`** in the same change set: *GCP Secret Manager* table, *GitHub Environment Secrets* (OIDC-only), and any `gcloud`/CLI examples.
2. Update **`AGENTS.md`** if operator-facing one-liners about deploy or secret source of truth change.
3. Avoid documenting **GitHub mirrors** for app runtime keys unless the workflow actually reads them from `secrets.*` — prefer **GCP Secret Manager as single source of truth** to match the workflow’s `--set-secrets` + `gcloud secrets describe` preflight.

## Output

- Docs updated/created
- Coverage gaps still open — prefer capturing non-blocking items in **`docs/PLAN.md`** (TODO / design TBD) instead of orphan comments
- Recommended doc owners/follow-ups
- Prefer **project-local** `.cursor/skills/` and this repo’s rules/docs over duplicating global Cursor defaults.
