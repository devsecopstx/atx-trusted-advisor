---
id: xdesign-review
name: xdesign-review
description: Final MVP PR review gate for atxFinance when combining Core MVP and Branding cloud-agent changes.
---

# xDesign Review: Final MVP Gate

## Goal

Provide a strict final review gate before accepting combined PR changes from:

- Core MVP cloud agent (API/domain/runtime)
- Branding cloud agent (UI/UX/visual system)

## Core MVP Scope (Revisit)

- **xChat** — Finance-enabled Grok session that **only responds to finance questions**. Implemented as a constrained chat experience; xPersona config and how search/RAG tools are used will be refined in a later TODO.
- **xCoach** — Currently a **stub**. Planned: licensing exam (timed test). Further scope (TODO) to be discussed.

## When to Use

- Final review before merging MVP changes to `main`.
- Any PR that includes both product logic and visual/brand changes.
- Any `xPersona`, `xChat`, `xCoach`, tool-routing, or admin-contract changes.

## Mandatory Reviewer Sequence

Run in this exact order and mark each as complete/incomplete:

1. `design-review-best-practices`
2. `xdesign-review`
3. `xdesign-review-adversarial`
4. `xdesign-review-reliability`
5. `xdesign-review-audit`

If any reviewer is skipped, final review is incomplete.

## Core MVP Acceptance Checks

- Route contract compatibility is preserved (`/api/*` responses, status codes, payload shape).
- Auth and tenant boundaries remain enforced (no privilege broadening).
- **xChat**: finance-only scope is preserved; validation and error paths remain stable. (TODO: xPersona config and search-tool usage reviewed in later pass.)
- **xCoach**: stub behavior is acceptable until licensing-exam scope is defined (TODO).
- No regressions in retries, fallbacks, or deploy-health checks.
- Critical env/secret assumptions are documented and unchanged unless explicitly approved.

## Branding Acceptance Checks

- Dark/light mode remains legible and consistent.
- Brand palette and typography remain coherent with existing atxFinance direction.
- UI changes do not break core task flows or accessibility basics.
- New visuals do not hide errors, states, or operator controls.

## Combined PR Risk Checks

- No hidden coupling between branding refactors and core runtime logic.
- No accidental API behavior drift from UI-driven model changes.
- Docs parity is updated where behavior changed — follow **`generate-docs`** baseline set (`AGENTS.md`, `DEVELOPMENT.md`, `README.md`, etc.).
- API/route changes keep **OpenAPI inventory** and route-parity tests green (`tests/integration/openapi-*.test.ts`; see `DEVELOPMENT.md#api-docs-validation`).
- Tests cover changed logic; missing tests are called out explicitly.

## Required Evidence Checklist

- Route contract evidence is captured (request/response samples for changed `/api/*` endpoints).
- Auth/tenant boundary evidence is captured (expected 401/403 behavior for protected routes).
- Test evidence is captured (`npm run test` / `npm run test:integration` when routes or contracts changed).
- Validation evidence is captured: **`npm run ci:gate`** (lint + typecheck + test); add **`npm run build`** for release/deploy-sensitive changes (see `AGENTS.md` release gate).

## Output Format (Required)

```md
## Findings
### High
- ...
### Medium
- ...
### Low
- ...

## Reviewer Completion
- design-review-best-practices: complete|incomplete
- xdesign-review: complete|incomplete
- xdesign-review-adversarial: complete|incomplete
- xdesign-review-reliability: complete|incomplete
- xdesign-review-audit: complete|incomplete

## Merge Recommendation
- accept | accept-with-conditions | reject

## Gaps
- missing tests (including OpenAPI/route parity when `/api/*` changed)
- missing docs sync (`generate-docs` baseline; operator runbooks)
- residual risk notes
```

## Deferred / TODO (Out of Scope for This Revisit)

- **xPersona**: detailed config and how it gates xChat scope — later TODO.
- **Search/RAG tools**: how they are used in xChat — later TODO.
- **xCoach**: full licensing-exam (timed test) design and implementation — stub only for now; will discuss more.

## Guardrails

- Findings-first review style: bugs/regressions before summaries.
- Do not invent behavior; verify from code/diff/tests.
- Treat auth, tenant isolation, and contract drift as high severity.
- Keep recommendations actionable and scoped to the touched changes.
- TODO: remove dependency on global Cursor skills; keep this project-local skill pack as source of truth.
