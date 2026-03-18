---
id: xfinance-design-ops
name: xfinance-design-ops
description: Concise xFinance design and ops review for xStrategyBuilder, Watchlist, Portfolio, and xPersona contracts.
---

# xFinance Design Ops

## Goal

Provide a fast, reliable review framework for core xFinance tool surfaces:

- `xStrategyBuilder`
- `Watchlist`
- `Portfolio`
- `xPersona` (admin CRUD + route contracts)

## Mandatory Review Bundle (xPersona scope)

1. `design-review-best-practices`
2. `xfinance-design-ops`
3. `xdesign-review-adversarial`
4. `xdesign-review-reliability`

If any reviewer is skipped, mark review as incomplete.

## Contract Checks

- Route contracts remain backward-compatible.
- Async/sync lifecycle behavior remains stable.
- Auth and tenant boundaries remain enforced.
- xPersona payload validation and audit behavior remain intact.
- Docs parity remains synchronized with runtime behavior.

## Quick Workflow

1. Diff scope with `git diff main --name-only`.
2. Map changed files to tool surfaces.
3. Validate contracts, lifecycle, and permissions.
4. Validate docs parity (`README.md`, env/setup docs, runbooks).
5. Report findings by severity (bugs/regressions first).

## Guardrails

- Do not fabricate behavior; verify from code.
- Treat route contract drift and lifecycle drift as high severity.
- Keep review scoped unless user asks to expand.
