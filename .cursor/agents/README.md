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

For commits authored via Cursor agents, **default** subject prefix:

- **`chore: aTx⚡ <summary>`** — use for both routine work and hotfixes (filter with `git log --grep=aTx⚡`).

Optional legacy: `cursor-chore:` / `cursor-hotfix:` — see **`.cursor/skills/test-commit-push/SKILL.md`** (workflow step 11).
