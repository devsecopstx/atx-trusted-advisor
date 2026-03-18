# design-review-best-practices Checklist

## Core Review Checklist

- [ ] Scope is explicit (full repo or user-limited area).
- [ ] `AGENTS.md`, `.cursor/rules/`, and key config files were consulted.
- [ ] Findings are actionable and avoid generic/nitpick feedback.

## Dimension Coverage Checklist

- [ ] Architecture review covers layering, separation of concerns, duplication, and dead code.
- [ ] TypeScript/Next.js review covers type safety, App Router patterns, and lint/typecheck hygiene.
- [ ] Kotlin/Spring review covers controller/service/repo boundaries, DTOs, and error handling (if applicable).
- [ ] Security review covers secrets handling, auth boundaries, input validation, rate limits, and injection risk.
- [ ] Data/API review covers MongoDB usage, contracts, backward compatibility, and error responses.
- [ ] Testing/quality review covers coverage gaps, validation commands, and CI/pre-commit posture.
- [ ] Docs/DX review covers `AGENTS.md`, README clarity, env setup, and run/validation docs.

## Output Quality Checklist

- [ ] Summary is concise (2-4 bullets) with clear priorities.
- [ ] Findings are grouped by dimension and include What -> Where -> Suggestion.
- [ ] Next steps are ordered by impact (security, reliability, DX) and remain concrete.
- [ ] No code changes are proposed/applied unless explicitly requested by the user.
