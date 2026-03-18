# Cursor Cloud Agent Personas

## Purpose

Define a stable, repo-local baseline for atxfinance multi-agent execution in Cursor Cloud.

## Persona Files

- `.cursor/agents/pr-reviewer.md`
- `.cursor/agents/feature-core-mvp.md`
- `.cursor/agents/feature-branding.md`

## Operating Model

1. **PR Reviewer** validates quality gates and merge readiness.
2. **Feature Core MVP** handles API/domain/runtime work.
3. **Feature Branding** handles UI and brand-system work.

## Validation Baseline

- `npm run env:cursor-cloud`
- `npm run typecheck`
- `npm run test`

## Notes

- OAuth status in staging is tracked as a separate auth/config concern.
- Agent persona setup is not blocked by staging OAuth readiness.
