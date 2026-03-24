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
6. **Docs & contracts:** Follow **`generate-docs`** Output for whatever you touched (API/OpenAPI, BFF, RAG `atx-rag-collection/`, branding deletes, xChat ask/prompts, strategy-options, `.cursor/rules`, agents/worktrees). Cross-check **`CHECKLIST.md`** (BFF: `bff-proxy-routes`, `nextBffApi`, HTTP spec, smoke). Deferred backlog: `atx-docs/atx-sre-ops/api-consolidation-spring-backend.md`, `PLAN.md`, `.cursor/plans/`. Core MVP + Branding or pre-prod: **`atxdesign-review`**; post-deploy: **`AGENTS.md`**.
7. **Mongo `tenant_portfolio`:** If collection naming or provisioning changes: align `collection-names.ts`, seeds/migrations, `DEVELOPMENT.md`, **`CHECKLIST.md`**; operators may need **`npm run migrate:tenant-portfolio`**.
8. **Auth / xchat / runtime config:** GCP Secret Manager for app secrets; GH OIDC-only secrets; deploy literals in GH variables. **`XAI_TEAM_ID`** when using team xAI collections (`atx-docs/atx-xchat/atx-multi-agent.md`). Preflight: `npm run ops:secrets:verify:staging` and `npm run ops:secrets:verify:prod`. Validate strict parsers (e.g. `ADMIN_SEED_EMAIL` clean email).
9. **`.cursor/rules/*.mdc`:** Valid YAML frontmatter, `globs`, no diff noise; branding/logo → **`xfinance-branding.mdc`**. See **`generate-docs`** § *Cursor rules*.
10. **Version:** App version from **`package.json`** via `src/lib/app-version.ts` (no hardcoded versions); bump `version` when shipping a release-worthy change. **`.cursor/agents/*.yaml`:** keep optional `icon` / `color` after `description` when adding or renaming agents.
11. **Commit message (Cursor agents):** Subject line: **`chore: aTx⚡ <summary>`** — use for **both** routine chores and urgent hotfixes (Conventional Commits `chore` type; filter with `git log --grep=aTx⚡`). The brand sits right after the colon.
    - Include **`package.json` version** in the subject when shipping a release — use the **current** version from step 10 / `package.json` (do not paste a stale version literal from this doc).
    - **Examples (substitute `vX.Y.Z` from `package.json`):** `chore: aTx⚡ release vX.Y.Z (xChat UX, personas)` · `chore: aTx⚡ hotfix empty tools guard in persona save` · `chore: aTx⚡ deps — bump vitest`
    - One-line subject is enough; add a body after a blank line only when context helps reviewers.
    - **Optional git hook:** `.githooks/commit-msg` can **hint** (or strictly enforce via `XFINANCE_ENFORCE_CURSOR_COMMIT=1`) on `agent/*`, `cursor/*`, and `release/*` branches — see **`.githooks/README.md`**. Hooks complement this doc; they do not replace it.
12. Confirm push readiness and branch status.
13. After push: create or update PR targeting **`main`** (`gh pr create --base main` or `gh pr view` + `gh pr edit` as needed).
14. **Staging first (when applicable):** Push branch, open/merge PR per policy, and verify staging before production (see `AGENTS.md` / deploy skills).
15. **Deploy:** Merge to **`main`** → **staging only** (no prod auto-deploy). Redeploy staging: **Deploy Cloud Run** (no inputs). Prod: **`workflow_dispatch`** → **Deploy Cloud Run Production** + **`confirm_manual_prod=yes`** (optional **`deployment_notes`**). See `AGENTS.md` if jobs skip.

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
