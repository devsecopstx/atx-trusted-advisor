---
id: test-commit-push
name: test-commit-push
version: 2.0.0
description: Execute a safe local validation flow (test, lint, typecheck), then prepare clean commit and push guidance.
---

# Test Commit Push v2.0.0

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
3. Run project test, lint, and typecheck commands.
4. Fix blocking failures in scope.
5. Re-run validation until clean.
6. Prepare concise commit message reflecting intent.
7. Confirm push readiness and branch status.

## Output

- Validation results
- Outstanding blockers (if any)
- Commit/push readiness summary

## Checklist

Detailed checklist moved to `CHECKLIST.md`.
