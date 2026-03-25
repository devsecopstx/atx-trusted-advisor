# Cursor agent personas (repo-local)

YAML agents under **`.cursor/agents/*.yaml`** tune Cursor Cloud / Composer for scoped work. They are **not** secrets — keep deploy steps in `DEVELOPMENT.md` / `AGENTS.md` and skills under **`.cursor/skills/`**.

## Current files

| File | Role | Use when |
|------|------|----------|
| [`backend.yaml`](backend.yaml) | Kotlin/Spring **atxfinance-backend**, BFF migration, portfolio/positions APIs, Yahoo/strategy-options | Backend slices, `services/atxfinance-backend/**`, `ATXFINANCE_BACKEND_ORIGIN` |
| [`frontend.yaml`](frontend.yaml) | **UI/UX + branding** — tokens, `src/app/**`, `atx-docs/design-system/**` | Visual work, a11y, responsive — avoid domain logic unless required |
| [`reviewer.yaml`](reviewer.yaml) | **PR / quality gate** reviewer — lint, typecheck, test, `ci:gate` | Pre-merge review, risk surface on changed files only |
| [`sre-ops-admin.yaml`](sre-ops-admin.yaml) | SRE / ops review persona | Infra, deploy, secrets hygiene, runbooks |
| [`feature-branding.yaml`](feature-branding.yaml) | Full-stack feature + branding (Next, tokens, APIs when needed for UI) | Default for cross-cutting product + UI work |
| [`marketing.yaml`](marketing.yaml) | GTM / X copy, threads, HNWI–RIA messaging | Marketing and waitlist copy only |

## Parallel worktrees (`.cursor/worktrees.json`)

[`worktrees.json`](../worktrees.json) configures:

1. **Setup scripts** — `setup-worktree`, `setup-worktree-unix`, `setup-worktree-windows` run when Cursor creates a parallel-agent worktree (`npm ci`, copy `.env` from the primary tree via `$ROOT_WORKTREE_PATH` / `%ROOT_WORKTREE_PATH%`). See [Cursor docs — Parallel Agents](https://cursor.com/docs/configuration/worktrees).
2. **Named worktrees** — the `worktrees` array lists `frontend`, `backend`, and `reviewer` (plus `sre-ops-admin`) with `description`, optional `npm` command hints, and a `setup` that stamps `ROLE=…` into **`.cursor/.frontend`**, **`.cursor/.backend`**, **`.cursor/.reviewer`** (local convenience only; not the agent YAML bodies).

## Conventions

- Keep prompts **narrow** and task-scoped; prefer deterministic commands (`npm run ci:gate`, `./gradlew test`).
- **Commit messages** for agent-authored commits: **`chore: aTx⚡ <summary>`** — see [`.cursor/skills/test-commit-push/SKILL.md`](../skills/test-commit-push/SKILL.md) (step 11).
- **App version** lives only in `package.json` (read via `src/lib/app-version.ts`); do not hardcode versions in agent or skill bodies.

## Skills index

Hundreds of workflows live in **`.cursor/skills/*/SKILL.md`**. High-traffic entry points:

| Area | Skill folder |
|------|----------------|
| Ship gate | `test-commit-push`, `test-lint`, `ci-failure` |
| Spring backend | `backend-start-local`, `backend-architecture`, `backend-runbook` |
| Deploy | `deploy-staging`, `deploy-production` |
| Design / audit | `atxdesign-review`, `atxdesign-review-audit`, `atxdesign-review-adversarial` |
| Docs | `generate-docs`, `sre-docs-ops` |
