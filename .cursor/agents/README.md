# Cursor Agent Personas

This folder defines repo-local agent personas for atxfinance Cursor Cloud usage.

Current personas:

- `atx-frontend.yaml`
- `atx-backend.yaml`
- `atx-reviewer.yaml`

Usage guidance:

- Keep persona prompts narrow and task-scoped.
- Prefer deterministic validation commands (`lint`, `typecheck`, `test`, `build`).
- Do not place secrets in persona files.
- Keep operational/deploy steps in runbooks, not persona prompts.

## Commit messages (agent traceability)

For commits authored via Cursor agents, use subject prefix:

- **`chore: aTx⚡ <summary>`** — routine work and hotfixes (filter with `git log --grep=aTx⚡`).

Full detail: **`.cursor/skills/test-commit-push/SKILL.md`** (workflow step 11).
