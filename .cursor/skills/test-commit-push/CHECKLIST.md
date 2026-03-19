# test-commit-push Checklist

## Pre-Validation

- [ ] Branch is clean for intended scope (`git status --short` reviewed).
- [ ] Main is synced (`git fetch origin` + merge/rebase policy applied).
- [ ] No conflict markers remain (`<<<<<<<`, `=======`, `>>>>>>>`).

## Validation Gates

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes when release-sensitive code changed.
- [ ] `npm run ci:gate && npm run build` passes for release/deploy-impacting changes.

## Commit Hygiene

- [ ] `.env.example` keeps empty `KEY=` values only (no credential-shaped placeholders or real identifiers).
- [ ] `.cursor/rules/*.mdc` files have valid frontmatter, repo-aligned `globs`, and no merge/patch artifacts (e.g. leading `+` lines).
- [ ] Commit scope excludes secrets and unrelated file churn.
- [ ] Message explains intent and risk surface, not just file list.
- [ ] Docs/runbooks updated when behavior or operations changed.
- [ ] Skill docs updated when process changed (`generate-docs`, `test-commit-push`, `AGENTS.md`).
- [ ] App version resolves from `package.json` via `src/lib/app-version.ts` — no hardcoded version strings in skills or UI.
- [ ] Open gaps (if any) are in **`docs/PLAN.md`** as TODO / design TBD, or consciously not applicable to this change.

## Staging-before-prod (optional)

- [ ] Push branch and merge PR per team policy, then deploy **staging** and smoke before production (see deploy runbooks / `AGENTS.md`).

## Push Readiness

- [ ] Branch is ahead as expected and tracks correct remote.
- [ ] CI-required workflows are green or queued with known status.
- [ ] Rollback path is understood for deployment-affecting changes.

## PR Create/Update

- [ ] After push: run `gh pr create` (new branch) or confirm `gh pr view` shows existing PR (already created).
- [ ] If PR exists and body/title need refresh: `gh pr edit --title "..." --body "..."`.
- [ ] Output PR URL for review.
