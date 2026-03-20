---
id: test-commit-push
name: test-commit-push
description: Execute a safe local validation flow (test, lint, typecheck), then prepare clean commit and push guidance.
---

# Test Commit Push

## Goal

Ship changes safely by validating locally and preparing an accurate commit workflow.

## Use This Skill When

- You are ready to ship a branch
- You want a clean pre-commit verification pass
- You need a consistent commit-ready checklist

## Workflow

1. Sync branch with latest `main` before commit:
   - `git fetch origin`
   - `git merge origin/main` (or rebase if team policy requires it)
2. If conflicts occur, resolve them first, then verify no conflict markers remain.
3. Run **`npm run ci:gate`** (lint + typecheck + test). Add **`npm run build`** when the change is release/deploy-sensitive or touches App Router/build artifacts (same as `AGENTS.md` release gate: `ci:gate && build`).
4. Fix blocking failures in scope.
5. Re-run validation until clean.
6. Confirm docs/skill updates for any changed runbooks or delivery workflow. Deferred doc/product gaps live in **`docs/PLAN.md`** (TODO / design TBD) — no need to block commit unless you are closing an item. For **`/api/*` or OpenAPI inventory** changes, follow **`generate-docs`** § *API docs & OpenAPI*. **Branding / investor / GTM / logo** changes: sync **`.cursor/rules/xfinance-branding.mdc`** and **`docs/xchat/xfinance-branding-review.md`** per **`generate-docs`** § *Branding, investor narrative & xChat product copy*. Combined Core MVP + Branding or **pre-prod release** PRs: run **`xdesign-review`** (includes production deploy lock); after deploy, **`AGENTS.md` → Production validation (post-deploy)**.
7. **Cursor rules (`.cursor/rules/*.mdc`)**: if changed, verify single valid YAML
   frontmatter, correct `globs`, no patch/diff noise (`+` prefixes). When logo
   or branding changes, update **`xfinance-branding.mdc`** (e.g. aTx⚡Finance).
   Use **`generate-docs`** § *Cursor rules* for the gap list.
8. Verify app version resolves from `package.json` via `src/lib/app-version.ts` (no hardcoded version literals in skills or UI; bump **`package.json`** `version` when shipping a release-worthy app version change).
9. Prepare concise commit message reflecting intent.
10. Confirm push readiness and branch status.
11. After push: create or update PR (`gh pr create` or `gh pr view` + `gh pr edit` as needed).
12. **Staging first (when applicable):** If the team ships to staging before prod, push the branch, open/merge PR per policy, then run staging deploy/verify (see `AGENTS.md` / deploy skills). Production can wait until staging checks pass.

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
