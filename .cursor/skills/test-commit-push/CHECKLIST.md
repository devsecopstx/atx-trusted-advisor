# test-commit-push Checklist v2.0.0

## Pre-Validation

- [ ] Branch is clean for intended scope (`git status --short` reviewed).
- [ ] Main is synced (`git fetch origin` + merge/rebase policy applied).
- [ ] No conflict markers remain (`<<<<<<<`, `=======`, `>>>>>>>`).

## Validation Gates

- [ ] `npm run lint` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run build` passes when release-sensitive code changed.

## Commit Hygiene

- [ ] Commit scope excludes secrets and unrelated file churn.
- [ ] Message explains intent and risk surface, not just file list.
- [ ] Docs/runbooks updated when behavior or operations changed.

## Push Readiness

- [ ] Branch is ahead as expected and tracks correct remote.
- [ ] CI-required workflows are green or queued with known status.
- [ ] Rollback path is understood for deployment-affecting changes.
