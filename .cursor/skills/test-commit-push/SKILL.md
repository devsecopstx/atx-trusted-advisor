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
3. Run project validation commands (including release gate when applicable).
4. Fix blocking failures in scope.
5. Re-run validation until clean.
6. Confirm docs/skill updates for any changed runbooks or delivery workflow. Deferred doc/product gaps live in **`docs/PLAN.md`** (TODO / design TBD) — no need to block commit unless you are closing an item.
6b. **Cursor rules (`.cursor/rules/*.mdc`)**: if changed, verify single valid YAML frontmatter, correct `globs` for this repo, and no patch/diff line noise (`+` prefixes). Use **`generate-docs`** § *Cursor rules* for the doc gap list.
7. Verify app version resolves from `package.json` via `src/lib/app-version.ts` (no hardcoded version strings in skills or UI).
8. Prepare concise commit message reflecting intent.
9. Confirm push readiness and branch status.
10. After push: create or update PR (`gh pr create` or `gh pr view` + `gh pr edit` as needed).
11. **Staging first (when applicable):** If the team ships to staging before prod, push the branch, open/merge PR per policy, then run staging deploy/verify (see `AGENTS.md` / deploy skills). Production can wait until staging checks pass.

## Output

- Validation results
- Outstanding blockers (if any)
- Commit/push readiness summary
- PR URL (created or updated)

## Checklist

Detailed checklist moved to `CHECKLIST.md`.

## Local Repo Policy

- Prefer project-local skill guidance in `.cursor/skills/` over global defaults.
