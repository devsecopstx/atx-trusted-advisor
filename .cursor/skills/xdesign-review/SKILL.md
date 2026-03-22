---
id: xdesign-review
name: xdesign-review
version: "1.1.0"
description: Final PR + production-readiness review gate for atxFinance when combining Core MVP and Branding changes (and pre-prod lock).
---

# xDesign Review: Final MVP / Production Gate

## Goal

Provide a strict final review gate before accepting combined PR changes from:

- Core MVP cloud agent (API/domain/runtime)
- Branding cloud agent (UI/UX/visual system)

Use the same skill for **pre-production lock**: merge to `main`, tag, and deploy only after this gate + **`npm run ci:gate && npm run build`** (see `AGENTS.md`).

## Core MVP Scope (Revisit)

- **xChat** — Finance-enabled Grok session; persona/RAG/tool behavior governed by published personas and `POST /api/xchat/ask`. See `docs/xchat/*.md` for contracts. **Prompt assembly:** `buildXchatSystemPrompt` / `buildSessionToolInstructions` / `appendXchatKbMetadata` in `src/modules/xchat/xchat-prompt-build.ts` and `batch-prompt-context.ts`. **Diagrams + flow:** `docs/xchat/xchat-tools-guide.md` — update when order or routing changes (xDesign doc parity).
- **xCoach** — Currently a **stub**. Planned: licensing exam (timed test). Further scope (TODO).

## When to Use

- Final review before merging MVP changes to `main`.
- Any PR that includes both product logic and visual/brand changes.
- Any `xPersona`, `xChat`, `xCoach`, tool-routing, or admin-contract changes.
- **Before production deploy:** run this gate after CI green; confirm **`generate-docs`** / OpenAPI parity if routes changed.

## Skill changelog

- **1.1.0** — xChat prompt assembly is centralized (`buildXchatSystemPrompt`, `buildSessionToolInstructions`, `appendXchatKbMetadata`); doc parity pointer remains `docs/xchat/xchat-tools-guide.md`.

## Versioning (SemVer — single source of truth)

- **Canonical app version** lives only in **`package.json`** (`version` field). Runtime UIs read **`src/lib/app-version.ts`** (`APP_VERSION_LABEL`). Do **not** hardcode version strings in skills or UI.
- **This skill’s `version` field** (frontmatter) tracks review-gate doc/process changes only; bump PATCH for doc-only, MINOR when the mandatory checklist or scope changes.
- Follow **SemVer 2.0.0**: **MAJOR.MINOR.PATCH** — bump MAJOR for breaking API/contract changes, MINOR for backward-compatible features, PATCH for fixes.
- Do **not** downgrade version numbers (e.g. never 1.0.6 → 1.0.0). “v1” product line = **1.x** on `main`; tag releases from signed tags per deploy runbooks (`.cursor/skills/atxfinance-deploy-production/SKILL.md`).

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
- **xChat**: validation and error paths remain stable; plan limits and persona resolution behave as documented; ask execution stays on the locked single Responses tool-loop path (no unplanned chat fallback drift).
- **xCoach**: stub behavior is acceptable until licensing-exam scope is defined (TODO).
- No regressions in retries, fallbacks, or deploy-health checks.
- Critical env/secret assumptions are documented and unchanged unless explicitly approved.

## Branding Acceptance Checks

- **xFinance** is **dark mode only** — legibility, contrast, and focus states; no light-theme requirement (see **`.cursor/rules/xfinance-branding.mdc`**). Wordmark lockup **aTx⚡Finance** (bolt between aTx and Finance) must match implementation in `src/app/ui/atxfinance-logo.tsx` when logo changes.
- Brand palette and typography remain coherent with **`design-system/atxfinance-brand-kit.css`** (`--xf-*` tokens; no stray hex in app CSS).
- UI changes do not break core task flows or accessibility basics.
- New visuals do not hide errors, states, or operator controls.

## Combined PR Risk Checks

- No hidden coupling between branding refactors and core runtime logic.
- No accidental API behavior drift from UI-driven model changes.
- Docs parity is updated where behavior changed — follow **`generate-docs`** baseline set (`AGENTS.md`, `DEVELOPMENT.md`, `README.md`, etc.).
- API/route changes keep **OpenAPI inventory** and route-parity tests green (`tests/integration/openapi-*.test.ts`; see `DEVELOPMENT.md#api-docs-validation`).
- Tests cover changed logic; missing tests are called out explicitly.

## Production Deploy Lock (additional)

Ship checklist (align with **`test-commit-push`** / **`AGENTS.md`**):

- [ ] **`npm run ci:gate`** and **`npm run build`** pass locally (or CI green on the merge commit).
- [ ] No conflict markers; branch rebased/merged per team policy.
- [ ] **Post-deploy validation:** health (`GET /api/health`), admin session, **app_user** path (`viewer`/`operator`/`advisor` + `/xchat` / `POST /api/xchat/ask`) — see **`AGENTS.md` → Production validation (post-deploy)**.
- [ ] Secrets only in GCP Secret Manager / env — never committed (see `DEVELOPMENT.md`).
- [ ] Optional: **`npm run status:deploy`** for stage/prod URLs and latest GitHub Actions runs.

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
- **Search/RAG tools**: advanced tuning — see `docs/xchat/`.
- **xCoach**: full licensing-exam (timed test) design and implementation — stub only for now.

## Guardrails

- Findings-first review style: bugs/regressions before summaries.
- Do not invent behavior; verify from code/diff/tests.
- Treat auth, tenant isolation, and contract drift as high severity.
- Keep recommendations actionable and scoped to the touched changes.
- Keep this project-local skill pack as source of truth; avoid duplicating global Cursor skills.
