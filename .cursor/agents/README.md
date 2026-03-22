# Cursor Agent Personas

This folder defines repo-local agent personas for atxfinance Cursor Cloud usage.

Current personas:

- `pr-reviewer.md`
- `feature-core-mvp.md`
- `feature-branding.md`

Usage guidance:

- Keep persona prompts narrow and task-scoped.
- Prefer deterministic validation commands (`lint`, `typecheck`, `test`, `build`).
- Do not place secrets in persona files.
- Keep operational/deploy steps in runbooks, not persona prompts.

## Commit messages (agent traceability)

For commits authored via Cursor agents, use subject prefixes so history is easy to filter:

- **Chores:** `cursor-chore: <summary>` **or** `chore: aTx⚡ <summary>` (Conventional Commits–friendly)
- **Hotfixes:** `cursor-hotfix: <summary>`

Full convention: **`.cursor/skills/test-commit-push/SKILL.md`** (workflow step 11).
