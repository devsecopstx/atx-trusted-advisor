# Cursor Agent Personas

This folder defines repo-local agent personas for xfinance Cursor Cloud usage.

Current personas:

- `pr-reviewer.md`
- `feature-core-mvp.md`
- `feature-branding.md`

Usage guidance:

- Keep persona prompts narrow and task-scoped.
- Prefer deterministic validation commands (`lint`, `typecheck`, `test`, `build`).
- Do not place secrets in persona files.
- Keep operational/deploy steps in runbooks, not persona prompts.
