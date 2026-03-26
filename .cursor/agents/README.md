# Cursor agent personas (repo-local)

Subagent files under **`.cursor/agents/*.md`** follow [Cursor Subagents](https://cursor.com/docs/subagents): YAML **frontmatter** (`name`, `description`, `model`, optional `readonly` / `is_background`) and a **Markdown body** for the system prompt plus repo-specific sections (instructions, context globs, commands). They are **not** secrets — keep deploy steps in `DEVELOPMENT.md` / `AGENTS.md` and skills under **`.cursor/skills/`**.

> Per Cursor’s documented schema, **`icon` and `color` are not supported** in frontmatter; the UI uses default subagent chrome.

## Current files

| File | Role | Use when |
|------|------|----------|
| [`backend.md`](backend.md) | Kotlin/Spring **atxfinance-backend**, BFF migration, portfolio/positions APIs, Yahoo/strategy-options | Backend slices, `services/atxfinance-backend/**`, `ATXFINANCE_BACKEND_ORIGIN` |
| [`frontend.md`](frontend.md) | **UI/UX** — App Router, Tailwind, branding rules, lean client JS | Visual work, a11y, responsive — avoid domain logic unless required |
| [`reviewer.md`](reviewer.md) | **PR / quality gate** — lint, typecheck, test, `ci:gate`, `build:stack` | Pre-merge review, risk on changed files + contract checks |
| [`sre.md`](sre.md) | SRE / ops persona | Infra, deploy, secrets hygiene, runbooks |
| [`branding.md`](branding.md) | Full-stack feature + branding (Next, tokens, OAuth CTAs, APIs when needed for UI) | Cross-cutting product + UI work |
| [`marketing.md`](marketing.md) | GTM / X copy, threads, HNWI–RIA messaging | Marketing and waitlist copy only |

## Parallel worktrees (`.cursor/worktrees.json`)

[`worktrees.json`](../worktrees.json) configures:

1. **Setup scripts** — `setup-worktree`, `setup-worktree-unix`, `setup-worktree-windows` run when Cursor creates a parallel-agent worktree (`npm install`, copy `.env` from the primary tree via `$ROOT_WORKTREE_PATH` / `%ROOT_WORKTREE_PATH%`). See [Cursor docs — Parallel Agents](https://cursor.com/docs/configuration/worktrees).
2. **Named worktrees** — the `worktrees` array lists `frontend`, `backend`, and `reviewer` (plus `sre-ops-admin`) with `description`, optional `npm` command hints, and a `setup` that stamps `ROLE=…` into **`.cursor/.frontend`**, **`.cursor/.backend`**, **`.cursor/.reviewer`** (local convenience only; not the subagent bodies).

## Conventions

- Keep prompts **narrow** and task-scoped; prefer deterministic commands (`npm run ci:gate`, `./gradlew test`).
- **Commit messages** for agent-authored commits: **`chore: aTx⚡ <summary>`** — see [`.cursor/skills/test-commit-push/SKILL.md`](../skills/test-commit-push/SKILL.md) (step 11).
- **App version** lives only in `package.json` (read via `src/lib/app-version.ts`); do not hardcode versions in agent or skill bodies.

## Skills index

Hundreds of workflows live in **`.cursor/skills/*/SKILL.md`**. High-traffic entry points:

| Area | Skill folder |
|------|--------------|
| Ship gate | `test-commit-push`, `test-lint`, `ci-failure` |
| Spring backend | `backend-start-local`, `backend-architecture`, `backend-runbook` |
| Deploy | `deploy-staging`, `deploy-production` |
| Design / audit | `atxdesign-review`, `atxdesign-review-audit`, `atxdesign-review-adversarial` |
| Docs | `generate-docs`, `sre-docs-ops` |
