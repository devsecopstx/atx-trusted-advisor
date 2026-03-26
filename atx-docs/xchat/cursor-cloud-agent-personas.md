# Cursor Cloud Agent Personas

## Purpose

Define a stable, repo-local baseline for atxfinance multi-agent execution in Cursor Cloud.

## Persona Files

See **`.cursor/agents/README.md`** for the full table. Core paths (extensionless files):

- `.cursor/agents/review`
- `.cursor/agents/backend`
- `.cursor/agents/frontend`
- `.cursor/agents/branding`, `.cursor/agents/sre`, `.cursor/agents/marketing`

## Operating Model

1. **review** validates quality gates and merge readiness.
2. **backend** handles API/domain/runtime work.
3. **frontend** handles UI; **branding** handles cross-cutting product + design tokens + OAuth CTAs when needed.

## Validation Baseline

- `npm run env:cursor-cloud`
- `npm run typecheck`
- `npm run test`

## Notes

- OAuth status in staging is tracked as a separate auth/config concern.
- Agent persona setup is not blocked by staging OAuth readiness.
