---
id: test-lint
name: test-lint
description: Run and stabilize test, lint, and typecheck pipelines with focused fixes.
---

# Test Lint

## Goal

Bring local quality gates to green: tests, lint checks, and static typing.

## Use This Skill When

- A branch fails quality checks
- You need a fast quality-gate pass before review
- Type or lint drift is accumulating

## Workflow

1. Run test suite.
2. Run lint checks (auto-fix where safe).
3. Run typecheck.
4. Address failures by root cause, not by suppression.
5. Re-run all gates for confirmation.

## Output

- Gate status per command
- Fixes applied
- Remaining failures and next step
