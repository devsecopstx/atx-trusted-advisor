---
id: design-review-best-practices
name: design-review-best-practices
version: "1.0.0"
description: Review the repository and suggest best practices or improvements. Use when the user asks for a design review, repo review, code review, best practices, or improvements.
---

# Design Review & Best Practices

Perform a structured review of the codebase and suggest actionable best practices or improvements. Follow this workflow.

## Mandatory Cross-Review Policy (xPersona Phase 1)

For any `xPersona` scope (`/admin/personas`, `/api/personas*`, persona data model/repository), this reviewer must be run together with:

- `xdesign-review`
- `xdesign-review-adversarial`
- `xdesign-review-reliability`

Final output must include an explicit completion checklist for all four reviewers.

## 1. Scope the Review

- **Breadth:** Prefer a full-repo pass unless the user limits scope (e.g. "frontend only", "API layer").
- **Sources of truth:** Read `AGENTS.md`, `.cursor/rules/`, and key config (e.g. `application.yml`, `package.json`, `tsconfig.json`) to align with project conventions.

## 2. Review Dimensions

Cover these areas; call out only **actionable** findings (no generic fluff).

| Area | What to check |
| ------ | ---------------- |
| **Architecture** | Layering (controller → service → repo), separation of concerns, duplication, dead code. |
| **TypeScript / Next.js** | Type safety (`any` misuse), Server vs Client Components, App Router usage, lint/typecheck hygiene. |
| **Kotlin / Spring** | Controller/service/repo boundaries, immutability, DTOs, error handling, alignment with project rules (e.g. Arrow-KT if present). |
| **Security** | Secrets handling, auth boundaries, input validation, rate limits, injection risks. |
| **Data / API** | MongoDB usage, API contracts, backward compatibility, error responses. |
| **Testing & quality** | Test coverage gaps, validation commands (Gradle, npm), pre-commit/CI. |
| **Docs & DX** | AGENTS.md accuracy, README, env setup, run/validation commands. |

## 3. Output Format

1. **Summary (2–4 bullets)** — Overall health and top priorities.
2. **Findings** — Grouped by dimension. Each item: **What** (concise) → **Where** (file/area) → **Suggestion** (concrete).
3. **Suggested next steps** — Ordered by impact (e.g. security first, then reliability, then DX). One line each; no implementation unless the user asks.

## 4. Constraints

- Do not change code unless the user asks for fixes.
- Respect project rules (AGENTS.md, .cursor/rules); suggest improvements that fit the stack (Next.js, Kotlin/Spring, MongoDB).
- Prefer high-signal, low-noise: skip nitpicks unless they affect correctness, security, or maintainability.

## 5. Environment and Secrets Standard

- Standardize on `.env` (do not use `.env.local` references).
- Keep required keys minimal unless product requirements explicitly demand more:
  - `MONGODB_URI_B64` (Base64-encoded MongoDB URI)
  - `XAI_API_KEY`
  - `X_OAUTH_CLIENT_ID`
  - `X_OAUTH_CLIENT_SECRET`
- Key source of truth for reviewers/operators:
  - xAI keys are managed in `https://console.x.ai/`
  - X OAuth keys are managed in `https://console.x.com/`
- For MongoDB, decode `MONGODB_URI_B64` at runtime and validate it resolves to `mongodb://` or `mongodb+srv://`.

## 6. Expected Repo Baseline Files

As part of design/DX review, verify these files exist and are coherent with code behavior:

- `README.md` (clear project purpose + quick start)
- `DEVELOPMENT.md` (detailed setup, env keys, operations, troubleshooting)
- `.env.example` (non-secret, current required keys only)
- `AGENTS.md` (operator runbook: commands, health checks, guardrails)
- `CONTRIBUTING.md` (branch/test/PR workflow)

If any are missing or stale, mark as a docs/DX finding with concrete patch recommendations.
