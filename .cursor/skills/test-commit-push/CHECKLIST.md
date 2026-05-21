# test-commit-push Checklist

## Pre-Validation

- [ ] Branch is clean for intended scope (`git status --short` reviewed).
- [ ] **`main`** is synced (`git fetch origin` + merge/rebase `origin/main` per policy).
- [ ] No conflict markers remain (`<<<<<<<`, `=======`, `>>>>>>>`).

## Validation Gates

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run docs:links` passes — scans the full **`atx-docs/`** markdown tree (not a single file); fixes broken `./` / `../` links and in-file `#anchors` before merge.
- [ ] `npm run build` passes when release-sensitive code changed.
- [ ] `npm run ci:gate && npm run build` passes for release/deploy-impacting changes.
- [ ] **`services/atxfinance-backend/**` changed:** `./gradlew test` passes (from `services/atxfinance-backend`), or `./gradlew compileKotlin` at minimum when only trivial edits.

## Commit Hygiene

- [ ] `.env.example` keeps empty `KEY=` values only (no credential-shaped placeholders or real identifiers).
- [ ] Auth/xchat env provenance is consistent: runtime secrets in GCP Secret Manager, GH env secrets OIDC-only, deploy literals in GH vars.
- [ ] Runtime secret preflight passes: `npm run ops:secrets:verify:staging` and `npm run ops:secrets:verify:prod`.
- [ ] Secret values satisfy parser constraints (for example `ADMIN_SEED_EMAIL` is valid and has no trailing comma/space).
- [ ] **Team xAI:** `XAI_TEAM_ID` is set per deployment/tenant where TEAM collection features run (**Phase 1** uses TEAM append/retrieval only — see `atx-docs/xchat/atx-multi-agent.md`).
- [ ] `.cursor/rules/*.mdc` files have valid frontmatter, repo-aligned `globs`, and no merge/patch artifacts (e.g. leading `+` lines).
- [ ] When logo or visual identity changes: update
  **`.cursor/rules/xfinance-branding.mdc`** to match (e.g. aTx⚡Finance).
- [ ] When branding, investor, or GTM copy changes: update
  **`atx-docs/xchat/xfinance-branding-review.md`** if the expert review doc should
  reflect it (see **`generate-docs`**).
- [ ] **Shell / header theme (`xf-ui-theme`, `PublicThemePicker`, `layout` boot script):** keep **`.cursor/agents/branding.md`** in sync; add or refresh the **§6 Shell theme** note in **`atx-docs/guides/local-development.md`**; unit-test pure helpers in **`src/lib/xf-ui-theme.ts`** (`tests/unit/xf-ui-theme.test.ts`). No OpenAPI change.
- [ ] **Billing list prices + limits matrix:** `atx-docs/resouces/atx-limits.txt.tsv` ↔ `src/lib/atx-billing-plan-limits.ts` ↔ `src/lib/atx-billing-plans.ts` ↔ `tests/unit/atx-billing-plans.test.ts` (Price row and card `priceLabel` / `periodNote` stay aligned).
- [ ] **xChat signed-in chrome (`xchat-conversation.tsx`):** left-rail default + thread collapse behavior matches **`.cursor/agents/branding.md`** (thread stays expanded while assistant `loading` if using default-collapsed thread).
- [ ] **Branding assets** live under **`atx-docs/branding/`** (not repo-root `atx-branding/` or `branding/`). If you add/move files there, keep **`DEVELOPMENT.md`**, **`AGENTS.md`**, **`tailwind.config.ts`**, and **`tests/unit/parse-watchlist-csv.test.ts`** paths in sync (see **`generate-docs`** → *Branding assets folder gaps*).
- [ ] Commit scope excludes secrets and unrelated file churn.
- [ ] Message explains intent and risk surface, not just file list.
- [ ] **Cursor agent commits** use **`chore: aTx⚡ …`** (see **`test-commit-push`** step 11).
- [ ] **`.cursor/agents/*.md`:** when touched, keep [Subagents](https://cursor.com/docs/subagents) frontmatter valid (`name`, `description`, `model`); body carries instructions and repo conventions (see **`test-commit-push`** step 10).
- [ ] Docs/runbooks updated when behavior or operations changed.
- [ ] **Mongo portfolio store:** canonical collection is **`tenant_portfolio`** (singular), constant `TENANT_PORTFOLIO_COLLECTION` in `src/modules/core-admin/collection-names.ts`. Legacy names `portfolio_portfolios` / `tenant_portfolios` → run **`npm run migrate:tenant-portfolio`** once per database before or right after deploy (see `DEVELOPMENT.md` → *Multi-tenant Seed Verification*).
- [ ] xChat `POST /api/xchat/ask` changes: update OpenAPI inventory (`src/lib/openapi/current-state-overrides.ts`), `tests/integration/xchat-ask-route.test.ts`, and xChat docs as needed (`atx-docs/xchat/xchat-tools-guide.md`, `atx-docs/xchat/context-routing-multi-agent-policy.md`, `atx-docs/xchat/atxfinance-tool-stub.md`, `AGENTS.md` quick ref). **Contract:** effective xAI model id comes from the **resolved persona’s `model`** (server default if empty); **no** request-body `model`; `modelSelectionSource` is `persona` | `default`. **Prompt assembly:** if `buildXchatSystemPrompt` / `buildSessionToolInstructions` / `appendXchatKbMetadata` change, sync **`generate-docs`** § *xChat / tools & prompts*.
- [ ] **`/api/strategy-options*`** (expirations + chain) or **`src/modules/strategy-options/**`** changes: update **`src/lib/openapi/current-state.ts`**, **`tests/integration/strategy-options*.test.ts`**, **`DEVELOPMENT.md`** (options chain section), and **`README.md`** / **DEVELOPMENT.md** route docs as needed — see **`generate-docs`** § *xStrategyBuilder / strategy-options*.
- [ ] **`atx-docs/design-system/xoptions/`** (`strategy-engine.md`, `StrategyEngine.svg`, `strategy-engine-fit-score-formula.png`) or **PLAN.md** 245/280 / **`.cursor/agents/reviewer.md`** OptionsStrategyEngine section: keep cross-links and reviewer plan in sync; **`npm run ci:gate`** for doc link tests. (Old `xStrategyBuilder/` content is archived.) **No Kotlin yet:** spec-only PRs may omit engine tests — note the gap for reviewer.
- [ ] **Spring BFF (proxied routes):** Kotlin **`@*Mapping`** ↔ **`bff-proxy-routes.ts`**, **`nextBffApi`** / **`backend-bff-api-object.test.ts`**, **`atx-docs/sre-ops/atxfinance-backend-http-api.md`**, smoke parity test, **`proxyRequestToBackend`** on affected **`src/app/api/**/route.ts`**.
- [ ] Skill docs updated when process changed (`generate-docs`, `test-commit-push`, `AGENTS.md`, `.cursor/skills/README.md`).
- [ ] **`.cursor/skills/**` changed:** `npm run skills:lint` passes (README index ↔ folders, frontmatter).
- [ ] App version resolves from `package.json` via `src/lib/app-version.ts` — no hardcoded version strings in skills or UI.
- [ ] **`package.json` version bumped:** **`atx-docs/sre-ops/release-notes.md`** has a **newest-first** one-line entry for that semver with a **`**Deploy:** …`** tag (see **`.cursor/agents/sre.md`** § Resources).
- [ ] **`BrokerIcon` / admin brokers catalog:** **`broker-brand-icons.tsx`** + **`tests/unit/broker-brand-icons.test.ts`** when TYPE/mark SVGs change.
- [ ] **Admin delivery-channels tabs:** tab parsers stay in server-safe **`delivery-channels-tabs.ts`** (not `"use client"` console modules).
- [ ] Open gaps (if any) are captured in **`atx-docs/sre-ops/api-consolidation-spring-backend.md`**, **`.cursor/plans/*.plan.md`**, or the relevant ops doc — or consciously not applicable to this change (see **`generate-docs`**).

## Staging and production

- [ ] Push branch and merge PR per team policy; deploy via **Deploy Cloud Run** (`.github/workflows/deploy-cloud-run.yml`, `workflow_dispatch` only) with inputs `branch`, `target` (`staging` | `production`), `confirm_manual_approval=yes`, and optional `deployment_notes`.
- [ ] Verify **staging** before deploying to **production**. Environment **Required reviewers** enforce manual approval gates; post-deploy Slack notification fires when `SLACK_WEBHOOK_URL` is configured. Legacy **Deploy Cloud Run Production** (`deploy-cloud-run-production.yml`) exists for rollback/fallback.
- [ ] **Manual Cloud Run (optional):** If GitHub Actions cannot run, deploy from a clean checkout with `gcloud`: staging first — **`npm run ops:deploy:cloud-run:staging`** — then prod — **`npm run ops:deploy:cloud-run:production`** after staging sign-off (see **`.cursor/agents/sre.md`**).
- [ ] **Post-deploy smoke (prod):** **`GET /api/health`** on the public base URL — **`status`: `ok`**, **`version`** matches **`package.json`** for the deployed revision (cheap regression guard).
- [ ] **If Next Cloud Run env changed:** **`PUBLIC_APP_BASE_URL`** + desk **`SMTP_*` / `DESK_EMAIL_FROM`** stay aligned with **`atx-docs/guides/deploy-and-ops.md`** § *Production checklist — access approval & transactional email* (avoid orphan GSM + literal conflicts on the same keys).

## Push Readiness

- [ ] Branch is ahead as expected and tracks correct remote.
- [ ] CI-required workflows are green or queued with known status.
- [ ] Rollback path is understood for deployment-affecting changes.

## PR Create/Update

- [ ] After push: run `gh pr create` (new branch) or confirm `gh pr view` shows existing PR (already created).
- [ ] If PR exists and body/title need refresh: `gh pr edit --title "..." --body "..."`.
- [ ] Output PR URL for review.
