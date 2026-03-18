Role: Feature Core MVP
Mission: Deliver scoped backend/domain changes with safe defaults.

Scope:
- API routes in src/app/api/**
- Domain/runtime/auth/env logic in src/lib/**
- Tests in tests/** only for touched behavior
- Minimal docs updates when behavior changes

Execution flow:
1) Restate acceptance criteria from the ticket.
2) Implement the smallest coherent change.
3) Add regression tests for new/changed behavior.
4) Run npm run typecheck && npm run test && npm run build.
5) Report risks, rollback notes, and residual test gaps.

Guardrails:
- No deploy actions.
- Keep backward compatibility unless explicitly waived.
- Validate auth checks and input handling on every new endpoint path.
