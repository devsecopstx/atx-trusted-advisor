---
name: generate-docs
description: Keep atxFinance docs, OpenAPI inventory, BFF contracts, xChat prompts, strategy-options, branding paths, and release notes aligned with code. Use when APIs, routes, personas, deploy flows, or operator runbooks change.
---

# Generate Docs (atxFinance)

## Goal

Update **existing** docs before adding new files. Every change should leave `npm run docs:links` and OpenAPI parity tests green.

## Use this skill when

- Features ship but `DEVELOPMENT.md` / `AGENTS.md` / `atx-docs/**` lag
- New or changed API routes need OpenAPI inventory updates
- BFF proxy registry or Spring `@*Mapping` paths move
- xChat prompt assembly, tools, or persona contracts change
- xOptions / strategy-options / payoff chart behavior changes
- Branding assets move under `atx-docs/branding/`
- Cursor rules (`.cursor/rules/*.mdc`) or skills process changes

## Workflow

1. List **behavior deltas** (user-visible + operator-visible).
2. Map each delta to a **canonical doc** (table below) — extend in place.
3. Add concrete examples, env keys, failure modes, and file paths.
4. Run **`npm run docs:links`** on touched markdown trees.
5. Run **`npm run skills:lint`** if `.cursor/skills/**` changed.
6. Note open gaps in `atx-docs/PLAN.md` or `atx-docs/sre-ops/api-consolidation-spring-backend.md` when not shipping the fix.

## Baseline docs set

| Doc | Purpose |
|-----|---------|
| `README.md` | Product scope, fast start |
| `DEVELOPMENT.md` | Full setup, env, API map, glossary |
| `AGENTS.md` | Operator commands, health checks, quick refs |
| `.env.example` | Key **names** only — empty values |
| `atx-docs/sre-ops/release-notes.md` | One line per semver bump (newest first) |
| `CONTRIBUTING.md` | Validation gates for contributors |

Prefer extending `DEVELOPMENT.md` + linking from `README.md` over scattered top-level docs.

## OpenAPI parity

When adding or changing **Next** route handlers under `src/app/api/**`:

1. Update `src/lib/openapi/current-state.ts` and/or `current-state-overrides.ts`.
2. Add or extend `tests/integration/*` route tests.
3. If admin-visible, confirm Swagger inventory at `/admin/api-docs`.

**xChat ask:** `POST /api/xchat/ask` — effective model from **resolved persona** (`persona.model`); **no** request-body `model`. Document `modelSelectionSource`: `persona` \| `default`. See `AGENTS.md` xChat quick ref.

## BFF / Spring backend

When Kotlin handlers or Next proxies change:

- `services/atxfinance-backend/**` `@*Mapping` ↔ `src/lib/bff-proxy-routes.ts`
- `nextBffApi` / `tests/unit/backend-bff-api-object.test.ts`
- `atx-docs/sre-ops/atxfinance-backend-http-api.md`
- Affected `src/app/api/**/route.ts` uses `proxyRequestToBackend` where required

## xChat / tools & prompts

Sync when touching `buildXchatSystemPrompt`, `buildSessionToolInstructions`, `appendXchatKbMetadata`, tool stubs, or RAG scope:

- `atx-docs/xchat/xchat-tools-guide.md`
- `atx-docs/xchat/context-routing-multi-agent-policy.md`
- `atx-docs/xchat/atxfinance-tool-stub.md`
- `atx-docs/xchat/xchat-debug-logging.md` (if logging changes)
- `tests/integration/xchat-ask-route.test.ts`

## xStrategyBuilder / strategy-options

When changing `/api/strategy-options*`, `src/modules/strategy-options/**`, or xOptions chain UI:

- OpenAPI + `tests/integration/strategy-options*.test.ts`
- `DEVELOPMENT.md` options chain section
- `atx-docs/xchat/xoptions-strategy-builder.md` (product behavior)

**Payoff chart implementation** (not a Cursor skill): `src/lib/options-payoff.ts`, `src/app/xstrategybuilder/ui/options-payoff-chart.tsx` — spec: `atx-docs/design-system/xStrategyBuilder/options-payoff-chart-spec.md`.

## OptionsStrategyEngine (PLAN 245)

Spec-only or engine changes:

- `atx-docs/design-system/xStrategyBuilder/strategy-engine.md`
- Assets: `StrategyEngine.svg`, `strategy-engine-fit-score-formula.png`
- Cross-check `.cursor/agents/reviewer.md` § *OptionsStrategyEngine*
- `atx-docs/PLAN.md` — outstanding vs shipped

## Cursor rules

When editing `.cursor/rules/*.mdc`:

- Valid YAML frontmatter (`description`, `globs` where used)
- No merge artifacts (`+` prefix lines, conflict markers)
- Logo / wordmark changes → `xfinance-branding.mdc` + `atx-docs/xchat/xfinance-branding-review.md`
- Shell theme → `.cursor/agents/branding.md` + `atx-docs/guides/local-development.md` § shell theme

## Branding assets

Assets live under **`atx-docs/branding/`** (not repo-root `branding/`). When moving files, sync paths in:

- `DEVELOPMENT.md`, `AGENTS.md`, `tailwind.config.ts`
- `tests/unit/parse-watchlist-csv.test.ts` (reference CSV path)

Intentional deletes: remove stale links; note in PR (see `atx-docs/xchat/xdesign-review-legacy-prompts-inventory.md`).

## RAG collection sources

When folders under `atx-docs/rag-collection/` or seed ingest contract changes:

- `atx-docs/rag-collection/rag-collection.md`
- `atx-rag-collection/README.md` if present
- `DEVELOPMENT.md` seed/RAG notes
- Admin ingest: `atx-docs` standalone trace paths in `src/lib/next-build-policy.ts`

## Billing / limits matrix

Keep aligned:

- `atx-docs/resouces/atx-limits.txt.tsv`
- `src/lib/atx-billing-plan-limits.ts`
- `src/lib/atx-billing-plans.ts`
- `tests/unit/atx-billing-plans.test.ts`

## Release notes & version

- Bump **`package.json`** only (runtime reads `src/lib/app-version.ts`).
- Append **one newest-first line** to `atx-docs/sre-ops/release-notes.md` with **Deploy:** tag (`Next`, `Spring`, `Full`, `Secrets`) per that file’s table.
- **Never** hardcode semver in skills or agent bodies.

## Cursor skills hygiene

When process or skill inventory changes:

- `.cursor/skills/README.md` (index)
- `.cursor/skills/skill-authoring.md` (frontmatter, lint, options recipe)
- `npm run skills:lint`
- `.cursor/agents/README.md` high-traffic pointers

## Output checklist

- [ ] Impacted docs updated with paths and commands
- [ ] `npm run docs:links` clean for touched trees
- [ ] OpenAPI / integration tests updated for API changes
- [ ] Release note line if version bumped
- [ ] Remaining gaps listed with owner or `PLAN.md` reference
