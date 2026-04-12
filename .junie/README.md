# Junie — Project Guides and Skills (repo-local)

This directory hosts Junie’s project knowledge for the atx Trusted Advisor monorepo. It complements existing docs in `atx-docs/` and the Cursor subagents/skills in `.cursor/`.

Principles:
- Single source of truth: deep-link to `atx-docs/**` and source files; avoid duplicating long references.
- Action-first: guides are concise primers; skills are repeatable playbooks with concrete commands and success checks.
- Safe-by-default: skills use repo scripts and non-destructive commands.

Structure:
- `guides/` — role/task-oriented primers with links to code.
- `skills/` — executable playbooks (`SKILL.md`, optional `CHECKLIST.md`).

How to use:
- Start with a guide to understand the flow, then run the matching skill to verify or ship.
- All commands assume repo root working directory unless noted.

Index:
- Guides
  - [Local development](./guides/local-development.md)
  - [Architecture overview](./guides/architecture-overview.md)
  - [Backend scheduler and tasks](./guides/backend-scheduler-and-tasks.md)
  - [Admin delivery channels and notify](./guides/admin-delivery-channels-and-notify.md)
  - [Billing and workspace limits](./guides/billing-and-workspace-limits.md)
  - [Deploy and ops](./guides/deploy-and-ops.md)
  - [Testing and CI](./guides/testing-and-ci.md)
- Skills
  - [Fix CI gate](./skills/fix-ci-gate/SKILL.md)
  - [Backend scheduler fan-out verify](./skills/backend-scheduler-fanout-verify/SKILL.md)
  - [Admin delivery channels verify](./skills/admin-delivery-channels-verify/SKILL.md)
  - [Billing guest vs authed consistency](./skills/billing-guest-vs-authed-consistency/SKILL.md)
  - [Landing page visual regression (light)](./skills/landing-page-visual-regression/SKILL.md)
  - [Deploy Cloud Run (staging)](./skills/deploy-cloud-run-staging/SKILL.md)
  - [Rotate secrets: xAI + OAuth](./skills/rotate-secrets-xai-oauth/SKILL.md)
  - [Test/commit/push compatibility](./skills/test-commit-push-compat/SKILL.md)
  - [Docs quarterly review (optional)](./skills/docs-quarterly-review/SKILL.md)

Maintenance cadence:
- Quarterly: run the docs review skill to catch drift or broken links.
- After key feature changes: update affected guide + verifier skill.
