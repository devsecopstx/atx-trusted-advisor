# test-commit-push Checklist v2.2.0

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

- [ ] Commit scope excludes secrets and unrelated file churn.
- [ ] Message explains intent and risk surface, not just file list.
- [ ] Docs/runbooks updated when behavior or operations changed.
- [ ] Skill docs updated when process changed (`generate-docs`, `test-commit-push`, `AGENTS.md`).
- [ ] App version references are aligned (`package.json` and `src/lib/app-version.ts` consumers).

## Push Readiness

- [ ] Branch is ahead as expected and tracks correct remote.
- [ ] CI-required workflows are green or queued with known status.
- [ ] Rollback path is understood for deployment-affecting changes.

## PR Create/Update

- [ ] After push: run `gh pr create` (new branch) or confirm `gh pr view` shows existing PR (already created).
- [ ] If PR exists and body/title need refresh: `gh pr edit --title "..." --body "..."`.
- [ ] Output PR URL for review.
