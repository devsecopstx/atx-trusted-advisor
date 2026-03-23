---
name: atx-feature-delivery
description: Deliver scoped atxfinance features as small pull requests with tests, clear commit history, and no direct deployment actions. Use when implementing tickets, bug fixes, or incremental product changes.
---

# atxfinance Feature Delivery

## Goal

Implement user-scoped tasks in small, reviewable PRs with strong validation and minimal blast radius.

## When To Use

- User asks to implement features or bug fixes
- User asks to create PR-ready changes
- User requests iterative development with isolated scope

## PR Strategy

Always prefer small PRs:

- Single concern per branch
- Clear acceptance criteria
- Fast review and merge
- Reduced merge conflicts and rollback risk

## Workflow

1. Confirm scope, constraints, and acceptance criteria.
2. Create branch: `agent/feature/<ticket-or-scope>`.
3. Implement minimal complete change.
4. Run validation (`npm run lint`, `npm run typecheck`, `npm run test`).
5. Commit with default subject **`chore: aTx⚡ <summary>`** (see **`test-commit-push`** skill step 11). Open PR with concise summary + test evidence.
6. Hand off for human review; no direct deployment from this workflow.

## Required Safety Rules

- Never push directly to `main`.
- Never bundle unrelated changes in one PR.
- Never bypass failing tests or lint in PR.
- Never include secrets in code, logs, or fixtures.

## Output Format

- Branch name
- Scope delivered
- Files changed
- Validation results
- Risks / follow-up items
- PR title and body draft
