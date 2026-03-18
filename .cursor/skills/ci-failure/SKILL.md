---
id: ci-failure
name: ci-failure
description: Investigate and fix CI failures quickly with a focused, reproducible workflow.
---

# CI Failure

## Goal

Diagnose failing CI jobs, identify the root cause, and deliver the smallest safe fix.

## Use This Skill When

- A pull request or branch has failing checks
- CI is flaky, red, or intermittently failing
- You need a quick pass from failure logs to fix plan

## Workflow

1. Identify the first failing job and stage.
2. Capture the exact failing command and error.
3. Reproduce locally with equivalent environment flags.
4. Apply a minimal scoped fix.
5. Re-run local validation for the impacted area.
6. Summarize root cause, fix, and remaining risk.

## Output

- Root cause summary
- Files changed (if any)
- Validation run + result
- Follow-up hardening actions
