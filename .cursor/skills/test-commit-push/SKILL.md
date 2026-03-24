---
id: test-commit-push
name: test-commit-push
description: Execute a safe local validation flow (test, lint, typecheck), then prepare clean commit and push guidance.
---

# Test Commit Push

## Goal

Ship changes safely by validating locally and preparing an accurate commit workflow.

## Canonical branch: `main`

- **Integration target:** Work lands on **`main`** via PR (or direct push only if repo policy allows and `main` is unprotected).
- **Before commit / push:** `git fetch origin` and integrate **`origin/main`** (`git merge origin/main` or rebase per team policy) so your branch is current.
- **PRs:** Default base is **`main`** — e.g. `gh pr create --base main` (GitHub UI: compare against **`main`**).
- **After merge to `main`:** Staging deploy only (see workflow steps 15–16); production is manual.

## Use This Skill When

- You are ready to ship a branch
- You want a clean pre-commit verification pass
- You need a consistent commit-ready checklist

## Workflow

1. Sync your branch with latest **`main`** before commit:
   - `git fetch origin`
   - `git merge origin/main` (or `git rebase origin/main` if team policy requires it)
2. If conflicts occur, resolve them first, then verify no conflict markers remain.
3. Run **`npm run ci:gate`** (lint + typecheck + test). When the change touches **`services/atxfinance-backend/**`**, also run **`./gradlew test`** from `services/atxfinance-backend` (or at least **`./gradlew compileKotlin`** for a quick compile-only pass). Add **`npm run build`** when the change is release/deploy-sensitive or touches App Router/build artifacts (same as `AGENTS.md` release gate: `ci:gate && build`).
4. Fix blocking failures in scope.
5. Re-run validation until clean.
6. **Docs & contracts:** Confirm docs/skill updates for changed runbooks or delivery workflow. Deferred gaps: **`atx-docs/atx-sre-ops/api-consolidation-spring-backend.md`** (BFF backlog), **`atx-docs/PLAN.md`**, **`.cursor/plans/*.plan.md`**, or a scoped ops doc — see **`generate-docs`** Output. **`.cursor/agents/`** / **`.cursor/worktrees.json`**: keep **`.cursor/agents/README.md`** and **`DEVELOPMENT.md`** agent tables aligned when personas or worktree stamps change. For **`/api/*` or OpenAPI inventory** changes, follow **`generate-docs`** § *API docs & OpenAPI*. **`POST /api/xchat/ask`:** keep OpenAPI + `xchat-ask-route` integration tests aligned with the live contract (persona-driven model, no body `model`; see **`CHECKLIST.md`**). **xChat prompt modules** (`xchat-prompt-build.ts`, `appendXchatKbMetadata`): keep **`atx-docs/atx-xchat/xchat-tools-guide.md`** aligned per **`generate-docs`** § *xChat / tools & prompts*. **`GET /api/strategy-options` / `GET /api/strategy-options/expirations`:** keep `current-state`, `strategy-options` integration tests, **`DEVELOPMENT.md`**, **`README.md`** in sync with **`generate-docs`** § *xStrategyBuilder / strategy-options*. **Branding / investor / GTM / logo:** sync **`.cursor/rules/xfinance-branding.mdc`** and **`atx-docs/atx-xchat/xfinance-branding-review.md`**. Update **`CHECKLIST.md`** rows for Spring BFF parity (`bff-proxy-routes`, `nextBffApi`, HTTP spec, smoke parity). Core MVP + Branding or **pre-prod release** PRs: run **`atxdesign-review`** (includes production deploy lock); after deploy, **`AGENTS.md` → Production validation (post-deploy)**.
7. **Mongo `tenant_portfolio` (singular):** if you change portfolio collection naming or provisioning, keep `collection-names.ts`, seed/backfill/migration scripts, and `DEVELOPMENT.md` aligned; ship checklist item in **`CHECKLIST.md`**; operators run **`npm run migrate:tenant-portfolio`** on existing DBs that still use legacy collection names.
8. For auth/xchat/runtime config changes, verify env provenance:
   - runtime app secrets in GCP Secret Manager,
   - GH env secrets OIDC-only,
   - deploy-time literals in GH variables.
   Ensure **`XAI_TEAM_ID`** is present where team xAI collections are used (`atx-docs/atx-xchat/atx-multi-agent.md`).
   - Run runtime secret preflight for both environments:
     `npm run ops:secrets:verify:staging` and `npm run ops:secrets:verify:prod`.
   - Validate secret value quality for strict parsers (example:
     `ADMIN_SEED_EMAIL` must be a valid email with no trailing comma/space).
9. **Cursor rules (`.cursor/rules/*.mdc`)**: if changed, verify single valid YAML
   frontmatter, correct `globs`, no patch/diff noise (`+` prefixes). When logo
   or branding changes, update **`xfinance-branding.mdc`** (e.g. aTx⚡Finance).
   Use **`generate-docs`** § *Cursor rules* for the gap list.
10. Verify app version resolves from `package.json` via `src/lib/app-version.ts` (no hardcoded version literals in skills or UI; bump **`package.json`** `version` when shipping a release-worthy app version change).
10b. **Cursor cloud agent YAML (`.cursor/agents/*.yaml`):** optional `icon` and `color` fields immediately after `description` improve agent pickers in Cursor; keep them present and distinct when adding or renaming agents.
11. **Commit message (Cursor agents):** Subject line: **`chore: aTx⚡ <summary>`** — use for **both** routine chores and urgent hotfixes (Conventional Commits `chore` type; filter with `git log --grep=aTx⚡`). The brand sits right after the colon.
    - Include **`package.json` version** in the subject when shipping a release — use the **current** version from step 10 / `package.json` (do not paste a stale version literal from this doc).
    - **Examples (substitute `vX.Y.Z` from `package.json`):** `chore: aTx⚡ release vX.Y.Z (xChat UX, personas)` · `chore: aTx⚡ hotfix empty tools guard in persona save` · `chore: aTx⚡ deps — bump vitest`
    - One-line subject is enough; add a body after a blank line only when context helps reviewers.
    - **Optional git hook:** `.githooks/commit-msg` can **hint** (or strictly enforce via `XFINANCE_ENFORCE_CURSOR_COMMIT=1`) on `agent/*`, `cursor/*`, and `release/*` branches — see **`.githooks/README.md`**. Hooks complement this doc; they do not replace it.
12. Confirm push readiness and branch status.
13. After push: create or update PR targeting **`main`** (`gh pr create --base main` or `gh pr view` + `gh pr edit` as needed).
14. **Staging first (when applicable):** Push branch, open/merge PR per policy, and verify staging before production (see `AGENTS.md` / deploy skills).
15. **Deploy path:** **Push to `main`** runs **staging only** via **Deploy Cloud Run** — production does **not** auto-deploy.
16. **Manual `workflow_dispatch`:** **Deploy Cloud Run** (no inputs) redeploys staging. **Deploy Cloud Run Production** (`workflow_dispatch` only; **no `push` trigger**) with **`confirm_manual_prod=yes`** runs production deploy (optional **`deployment_notes`** for Slack). Operators should verify staging before promoting prod (see `AGENTS.md` / `.github/workflows/deploy-cloud-run-production.yml`). If jobs show `skipped`, verify workflow and input names first.

## Output

- Validation results
- Outstanding blockers (if any)
- Commit/push readiness summary
- PR URL (created or updated)

## Checklist

Detailed checklist moved to **`CHECKLIST.md`** (includes `ci:gate`, optional `build`, OpenAPI/commit hygiene).

## Local Repo Policy

- Prefer project-local skill guidance in `.cursor/skills/` over global defaults.

## Optional: merge several local branches into `main`

Use when integrating stacked or stale branches locally (not one PR per branch):

1. `git fetch origin` and start from up-to-date `main`.
2. Merge branches **one at a time** in an agreed order (`git merge <branch>`).
3. Resolve conflicts using repo docs as source of truth (e.g. **GCP Secret Manager + OIDC-only** GitHub env — see `DEVELOPMENT.md` / `AGENTS.md`); do not reintroduce app secrets into GitHub preflight.
4. Complete each merge with `git commit`; then **`git branch -d <branch>`**; **`git push origin --delete <branch>`** if the remote still exists (ignore “remote ref does not exist” if already deleted).
5. Run **`npm run ci:gate`** and **`npm run build`** before pushing.
6. Push **`main`**: `git push origin main`. If **`main` is protected**, push a throwaway branch and open **`gh pr create --base main --head <branch>`** instead of merging locally.
