# test-commit-push Checklist

## Pre-Validation

- [ ] Branch is clean for intended scope (`git status --short` reviewed).
- [ ] **`main`** is synced (`git fetch origin` + merge/rebase `origin/main` per policy).
- [ ] No conflict markers remain (`<<<<<<<`, `=======`, `>>>>>>>`).

## Validation Gates

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes when release-sensitive code changed.
- [ ] `npm run ci:gate && npm run build` passes for release/deploy-impacting changes.

## Commit Hygiene

- [ ] `.env.example` keeps empty `KEY=` values only (no credential-shaped placeholders or real identifiers).
- [ ] Auth/xchat env provenance is consistent: runtime secrets in GCP Secret Manager, GH env secrets OIDC-only, deploy literals in GH vars.
- [ ] Runtime secret preflight passes: `npm run ops:secrets:verify:staging` and `npm run ops:secrets:verify:prod`.
- [ ] Secret values satisfy parser constraints (for example `ADMIN_SEED_EMAIL` is valid and has no trailing comma/space).
- [ ] Required xChat keys are present where expected: `XAI_TEAM_ID`, `ATXFINANCE_COLLECTION_ID`.
- [ ] `.cursor/rules/*.mdc` files have valid frontmatter, repo-aligned `globs`, and no merge/patch artifacts (e.g. leading `+` lines).
- [ ] When logo or visual identity changes: update
  **`.cursor/rules/xfinance-branding.mdc`** to match (e.g. aTx⚡Finance).
- [ ] When branding, investor, or GTM copy changes: update
  **`docs/xchat/xfinance-branding-review.md`** if the expert review doc should
  reflect it (see **`generate-docs`**).
- [ ] Commit scope excludes secrets and unrelated file churn.
- [ ] Message explains intent and risk surface, not just file list.
- [ ] **Cursor agent commits** use **`chore: aTx⚡ …`** (see **`test-commit-push`** step 11).
- [ ] Docs/runbooks updated when behavior or operations changed.
- [ ] **Mongo portfolio store:** canonical collection is **`tenant_portfolio`** (singular), constant `TENANT_PORTFOLIO_COLLECTION` in `src/modules/core-admin/collection-names.ts`. Legacy names `portfolio_portfolios` / `tenant_portfolios` → run **`npm run migrate:tenant-portfolio`** once per database before or right after deploy (see `DEVELOPMENT.md` → *Multi-tenant Seed Verification*).
- [ ] xChat `POST /api/xchat/ask` changes: update OpenAPI inventory (`src/lib/openapi/current-state-overrides.ts`), `tests/integration/xchat-ask-route.test.ts`, and xChat docs as needed (`docs/xchat/xchat-tools-guide.md`, `context-routing-multi-agent-policy.md`, `atxfinance-tool-stub.md`, `AGENTS.md` quick ref). **Contract:** effective xAI model id comes from the **resolved persona’s `model`** (server default if empty); **no** request-body `model`; `modelSelectionSource` is `persona` | `default`. **Prompt assembly:** if `buildXchatSystemPrompt` / `buildSessionToolInstructions` / `appendXchatKbMetadata` change, sync **`generate-docs`** § *xChat / tools & prompts*.
- [ ] **`/api/strategy-options*`** (expirations + chain) or **`src/modules/strategy-options/**`** changes: update **`src/lib/openapi/current-state.ts`**, **`tests/integration/strategy-options*.test.ts`**, **`DEVELOPMENT.md`** (options chain section), and **`README.md`** Core Routes — see **`generate-docs`** § *xStrategyBuilder / strategy-options*.
- [ ] Skill docs updated when process changed (`generate-docs`, `test-commit-push`, `AGENTS.md`).
- [ ] App version resolves from `package.json` via `src/lib/app-version.ts` — no hardcoded version strings in skills or UI.
- [ ] Open gaps (if any) are in **`docs/PLAN.md`** as TODO / design TBD, or consciously not applicable to this change.

## Staging and production

- [ ] Push branch and merge PR per team policy; **`main`** deploys **staging** only (see `AGENTS.md` / `.github/workflows/deploy-cloud-run.yml`; production is `.github/workflows/deploy-cloud-run-production.yml`).
- [ ] **Production** is **manual**: **Deploy Cloud Run Production** (`workflow_dispatch` only) with **`confirm_manual_prod=yes`**. Verify staging before running prod; optional **Required reviewers** on GitHub environment **`production`**.

## Push Readiness

- [ ] Branch is ahead as expected and tracks correct remote.
- [ ] CI-required workflows are green or queued with known status.
- [ ] Rollback path is understood for deployment-affecting changes.

## PR Create/Update

- [ ] After push: run `gh pr create` (new branch) or confirm `gh pr view` shows existing PR (already created).
- [ ] If PR exists and body/title need refresh: `gh pr edit --title "..." --body "..."`.
- [ ] Output PR URL for review.
