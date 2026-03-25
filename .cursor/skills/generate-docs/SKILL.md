---
id: generate-docs
name: generate-docs
description: Update and generate concise, accurate docs for changed systems, APIs, and runbooks.
---

# Generate Docs

## Goal

Keep project documentation aligned with code changes and operational reality.

## Use This Skill When

- Features changed but docs lag behind
- New APIs/workflows need examples
- Runbooks need clearer setup or troubleshooting steps

## Workflow

1. Identify changed behavior and impacted docs.
2. Update existing docs before creating new ones.
3. Add concrete examples, constraints, and failure modes.
4. Keep structure scannable and concise.
5. Validate commands and paths in docs.
6. Keep version references consistent across docs and UI surfaces.

## Baseline Docs Set (xFinance Core)

Default to maintaining this minimum docs set:

- `README.md`: product scope + fast local start.
- `DEVELOPMENT.md`: full setup, required env keys, runbooks, API map, and (when present) **Cursor agents & skills** discovery.
- `.env.example`: empty `KEY=` lines and required key names only
  (no credential-shaped placeholders).
- `AGENTS.md`: operator-centric commands/checks and troubleshooting.
- `CONTRIBUTING.md`: local validation + PR quality gates.

### Cursor agents & worktrees (repo-local)

When **adding, renaming, or materially changing** persona files under **`.cursor/agents/*.md`**:

- Keep **`.cursor/agents/README.md`** accurate: table of files, role intent, and “use when” scope.
- If **`.cursor/worktrees.json`** lists named worktrees / `setup` stamps, keep README prose aligned (parallel agents + optional `ROLE` stamps are local convenience only).
- If **`AGENTS.md`** or **`DEVELOPMENT.md`** point at agent filenames, update those pointers in the **same** change set as the rename.

**Naming convention:** Prefer stable, role-clear agent YAML names (e.g. `backend.yaml`, `reviewer.yaml`, `frontend.yaml`). Avoid duplicating the same role under two filenames without a README deprecation note.

When introducing new subsystems, prefer extending `DEVELOPMENT.md`
and linking from `README.md` instead of creating scattered top-level docs.

**xChat / branding:** Keep **`atx-docs/xchat/xfinance-branding-review.md`**
in sync when **`xfinance-branding.mdc`** or logo/hero/pricing messaging
changes materially.

**xChat / observability:** When changing **`ENABLE_XCHAT_DEBUG`**,
**`src/lib/xchat-debug.ts`**, or ask/batch logging prefixes, update
**`atx-docs/xchat/xchat-debug-logging.md`**
(`type` taxonomy, values, privacy).
If `GET /api/xchat/history` or `GET /api/xchat/history/stats` logging changes,
include `xchat_history_list` / `xchat_history_stats` in the taxonomy docs.

**xChat / tools & prompts:** When changing `POST /api/xchat/ask` prompt assembly,
`respondWithXaiToolLoop`, `personaXapiToolsToXaiRequestTools`, workspace snapshot,
batch persona parity, or RAG/tool routing, update **`atx-docs/xchat/xchat-tools-guide.md`**
(mermaid workflow + tables). **Source modules to keep in sync with prose:**

- **`src/modules/xchat/xchat-prompt-build.ts`** — `buildXchatSystemPrompt`, `buildSessionToolInstructions` (session tool copy; formerly exported strings on `default-xpersonas.ts`).
- **`src/modules/xchat/batch-prompt-context.ts`** — `appendXchatKbMetadata` (KB suffix on user turns for ask + batch; do not use the old name `buildBatchUserPromptAugmentation` in docs).
- **`atx-docs/xchat/atxfinance-tool-stub.md`** — cross-check when session blocks or KB metadata change (batch behavior lives under **Batch** in `xchat-tools-guide.md`).

**Auth identity placeholders:** When changing X OAuth identity-email behavior
(`src/lib/x-identity-email.ts`, `/api/auth/x/callback`, `/api/auth/link-email`):
- Document synthetic login identifier format and compatibility rules
  (for example legacy `@x.identity.local` support and current placeholder domain).
- Keep operator guidance explicit that synthetic login identifiers are not
  user contact emails.
- If access-request payload shape changes, sync API/runbook docs with the
  `AccessRequest` contract (for example `contactEmail` tracked separately).

## API docs & OpenAPI (route changes)

When **`src/app/api/**`** or public HTTP contracts change:

- Keep **`DEVELOPMENT.md`** *api-docs-validation* section accurate
  (inventory build, route parity).
- CI guards OpenAPI via `tests/integration/openapi-*.test.ts`.
  Run **`npm run ci:gate`** (and **`npm run build`** if release-sensitive)
  before merge.

### Next.js → Spring (atxfinance-backend) BFF migration

When **`ATXFINANCE_BACKEND_ORIGIN`** proxy behavior, Kotlin controllers, or BFF route lists change:

- Keep **`atx-docs/sre-ops/api-consolidation-spring-backend.md`** (status, deferred slices, operational parity) current.
- Keep **`atx-docs/sre-ops/atxfinance-backend-http-api.md`** aligned with implemented Spring routes.
- Keep **`tests/smoke/backend-http-api-parity.test.ts`** (and any **`src/lib/bff-proxy-routes.ts`** or **`src/lib/backend-bff.ts`** registry, if present) consistent with the proxy surface.
- For JVM changes, **`services/atxfinance-backend`** tests / HTTP API doc updates should land in the **same** slice as the Next proxy change when possible.

**xStrategyBuilder / strategy-options (Yahoo option chain):** When changing
`GET /api/strategy-options`, `GET /api/strategy-options/expirations`, UI under
`/xstrategybuilder/strategy-options`, or **`src/modules/strategy-options/**`**:

- Update **`DEVELOPMENT.md`** (xStrategyBuilder options chain subsection).
- Update **`README.md`** Docs / **DEVELOPMENT.md** route pointers if the public route summary should change.
- Update **`src/lib/openapi/current-state.ts`** (and tag description if the surface meaning changes).
- Keep **`tests/integration/strategy-options*.test.ts`** aligned with query params and response shape.
- Treat **xfinance-strategy** `GET /api/options` / expirations as **behavioral reference**; this app’s paths and auth are session-scoped — verify parity notes in docs if contracts diverge.

### Cross-repo API examples (xfinance-strategy)

If implementation ideas are imported from sibling repos
(for example **`xfinance-strategy/api-spec/openapi.yaml`**):

- Treat external specs as **reference only**.
  This repo's public contract remains
  **`src/lib/openapi/current-state.ts`** + generated `/api/openapi`.
- When adopting endpoint patterns from external OpenAPI docs,
  explicitly verify auth model, path naming, and response shape against
  this app's session/tenant rules before documenting parity.
- If a route or tag description is changed here,
  sync local docs/tests first
  (`DEVELOPMENT.md` API map + `tests/integration/openapi-*.test.ts`)
  before noting "aligned with strategy examples".

## xAI tools & collections (external reference)

When documenting persona tools, RAG, or batch behavior for xChat:

- **Collections search** (knowledge bases):
  upstream docs describe **`collections_search`** in the xAI SDK vs
  **`file_search`** in OpenAI-compatible Responses API.
  Same capability, different names.
  See [xAI - Collections Search tool](https://docs.x.ai/developers/tools/collections-search).
- **This codebase** maps persona `collections_search` -> `file_search`
  with `source.collection_ids` in **`src/lib/xai-tools.ts`**
  (`toXaiRequestTools`).
  Document that mapping when touching personas or batch payloads so
  operators are not confused by SDK vs HTTP naming.
- **RAG index stats:**
  `GET /api/personas/collections` and
  `GET /api/personas/collections/:collectionId` return
  `documentCount`, `chunkCount`, `fileCount`, `indexStatus` when the
  xAI Management API provides them.
  Admin RAG console (`/admin/rag-files`) displays these.
  Update `DEVELOPMENT.md` and OpenAPI inventory when adding/changing
  collection stats fields.
- **Batch API (canonical upstream):**
  [xAI - Batch API](https://docs.x.ai/developers/advanced-api-usage/batch-api)
  flow is create batch -> add requests
  (or JSONL upload with `custom_id`, `method`, `url`, `body`) ->
  poll status until pending reaches zero -> paginate results.
  Processing is typically async (often within 24 hours per docs), not
  synchronous from submit.
  For tool use, server-side tools run during processing; client-side
  function tools return `tool_calls` in the response, and multi-turn
  requires new batch requests with tool results.
  This repo's JSONL path uses `src/lib/xai-batch.ts` +
  `src/modules/xchat/batch-service.ts` with `/v1/responses` or
  `/v1/chat/completions` per line.

## Branding, investor narrative & xChat product copy

When **positioning, GTM, waitlist, investor deck copy**, or
**logo / visual identity** change:

- **Cursor rule (source of truth):**
  **`.cursor/rules/xfinance-branding.mdc`** for tagline,
  **aTx⚡Finance** lockup, **$2/hr** lock-in vs roadmap tiers,
  differentiation, weak-spot honesty, channels, and compliance narrative.
- **Expert review doc:**
  **`atx-docs/xchat/xfinance-branding-review.md`** for logo/hero/design-system
  alignment with the rule. Link or summarize rule updates there when it is
  the stakeholder-facing explainer.
- Do **not** duplicate conflicting pricing:
  shipped UI keeps **$2/hr** on primary surfaces; roadmap subscription tiers
  stay secondary (deck/waitlist) until productized.

### RAG collection sources (`atx-rag-collection/`)

**Scope:** In-repo **source artifacts** for **app RAG / xPersona KB** and **`npm run seed:admin`** xAI upload when keys resolve — **not** Cursor Cloud agent definitions (those stay in **`.cursor/agents/*.yaml`** only).

When adding or reorganizing content under **`atx-rag-collection/`**:

- **RAG path rule:** prefer **`atx-rag-collection/<segment>/<stem>/<stem>.<ext>`** (folder name = file stem) — see **`atx-rag-collection/README.md`**. Segments: **`xpersonas/`** (YAML + markdown), **`finance-reference-docs/`** (PDFs), **`example-prompts/`**, **`options-strategy/`**. Legacy folder names **`personas-trusted-family`**, **`xchat-example-prompts`**, **`atx-*`** are ingest path fallbacks only.
- Prefer PDF filenames **without spaces**; use a consistent prefix pattern (vendor or topic) for automation.
- Keep **`atx-rag-collection/README.md`** accurate when layout, seed contract, or ingest behavior changes.
- Shared prompts should avoid **personal / PII** unless explicitly scoped as non-production samples.
- When **wiring seed → xAI / Mongo**, update **`DEVELOPMENT.md`** (seed / RAG section), **`atx-docs/PLAN.md`**, and add **tests** for path resolution / idempotency (see **`test-commit-push`** step 6).

### Branding assets folder gaps (`atx-docs/branding/`)

When files under **`atx-docs/branding/`** are added, replaced, or deleted:

- Update **`atx-docs/branding/README.md`** if the asset set, naming convention, or
  "how to use" workflow changed.
- Record a quick QA pass in **`atx-docs/branding/atxfinance-brand-validation.md`**
  (or link equivalent review output) for non-trivial creative refreshes.
- If deletions are intentional, note rationale in PR summary and ensure
  no docs/rules still reference removed filenames.
- Keep generated assets and source prompts consistent:
  if prompt taxonomy changes, sync
  `atx-docs/branding/atxfinance-brand-prompts.md` and
  `atx-docs/branding/atxfinance-branding-tags.md`.

## PR review handoff

For combined Core MVP + Branding PRs, the final gate sequence lives in
**`atxdesign-review`** (reviewer order + production deploy lock).
Use this skill for doc/runbook updates.
Use **`test-commit-push`** for the local validation pass.
Post-deploy smoke steps live in
**`AGENTS.md` -> Production validation (post-deploy)**.

## Cursor rules (`.cursor/rules/*.mdc`)

### Gaps to avoid

- **Patch noise:** rule files must not contain leading `+` lines or
  duplicate frontmatter blocks (merge artifacts break Cursor parsing).
- **Wrong globs:** paths must match **this** repo.
  Example xChat globs:
  `src/app/xchat/**`, `src/app/api/xchat/**`,
  `src/modules/xchat/**`, `atx-docs/xchat/**`.
  Do not use other monorepo layouts.
- **Drift:** if a rule references APIs or folders that moved,
  update the rule in the same PR as the code move.

### When to document

- New or heavily updated `.mdc` files:
  add a **one-line pointer** in `DEVELOPMENT.md` or `AGENTS.md`
  under Cursor/agent setup *if* operators need discovery.
  Otherwise, the rule is self-describing via `description` + `globs`.
- xChat-specific product/agent notes stay in **`atx-docs/xchat/`**;
  keep rules short and link out.

## Version Consistency Rules

- Canonical app version lives only in `package.json`.
- Runtime surfaces (admin footer, etc.) must resolve via
  `src/lib/app-version.ts`.
  Do not hardcode version strings in UI or skill files.
- Skill `.md` files must never contain app version literals;
  a `package.json` version bump must not require touching skills.

## Local Skill Sync

- Keep docs-ops guidance aligned with:
  - `.cursor/agents/README.md` (persona table + worktrees notes when agents change)
  - `.cursor/skills/test-commit-push/SKILL.md`
  - `.cursor/skills/test-commit-push/CHECKLIST.md`
  - `.cursor/skills/test-automation/SKILL.md` (when adding or scoping tests)
  - `.cursor/skills/atxdesign-review/SKILL.md`
    (combined MVP + branding + pre-prod lock)
  - `.cursor/skills/sre-docs-ops/SKILL.md` (docs ops)
  - `.cursor/skills/sre-ops-gcp-gke/SKILL.md` (GKE SRE)
  - `AGENTS.md`
- Rule changes under `.cursor/rules/` ship with the same validation pass
  as skills (see test-commit-push checklist).

## Deploy / secrets doc parity (xFinance)

When `.github/workflows/deploy-cloud-run.yml` or `.github/workflows/deploy-cloud-run-production.yml` changes
**which env vars or Secret Manager names** are validated or mounted:

1. Update **`DEVELOPMENT.md`** in the same change set:
   *GCP Secret Manager* table, *GitHub Environment Secrets* (OIDC-only),
   and any `gcloud`/CLI examples.
2. Update **`AGENTS.md`** if operator-facing one-liners about deploy
   or secret source-of-truth guidance change.
3. Avoid documenting **GitHub mirrors** for app runtime keys unless the
   workflow actually reads them from `secrets.*`.
   Prefer **GCP Secret Manager as single source of truth** to match the
   workflow `--set-secrets` plus
   `gcloud secrets describe` preflight.
4. Keep SRE automation commands current:
   - `npm run ops:secrets:verify:staging`
   - `npm run ops:secrets:verify:prod`
   - `scripts/ops/verify-gcp-runtime-secrets.sh`
   If required secrets change, update script + docs in the same PR.
5. Treat `ADMIN_SEED_EMAIL` as a required runtime secret for deploy preflight
   and admin bootstrap workflows; do not leave it undocumented or optional in
   production readiness checklists.
6. Document secret **value-quality** checks, not just existence checks:
   include examples of invalid values (e.g., trailing comma in
   `ADMIN_SEED_EMAIL`) and the expected health symptom (`Invalid environment configuration`).
7. Document deploy gating: **push to `main`** runs **staging only** (**Deploy Cloud Run**); **production** via **Deploy Cloud Run Production** (`workflow_dispatch` only, **`confirm_manual_prod=yes`**, optional notes; no `push` trigger).
8. Keep staging/prod job gating rules documented when workflow conditions change
   (for example, when prod is removed from the push path or manual prod inputs change).

## xChat prompt docs parity

When updating prompt tips/chips or persona examples in xChat:

1. Keep **`atx-docs/xchat/atxfinance-xchat-prompts.md`** in sync with the actual
   UI surface (`src/app/xchat/ui/xchat-conversation.tsx`).
2. Do not document persona chips that are not currently rendered.
3. If prompts are "planned" and not shipped, label them as backlog/TODO and
   keep shipped behavior first.

## Output

- Docs updated/created
- Coverage gaps still open:
  prefer capturing non-blocking items in **`atx-docs/sre-ops/api-consolidation-spring-backend.md`** (BFF / Spring migration backlog), **`atx-docs/PLAN.md`** (product / multi-agent / admin follow-ups), **`.cursor/plans/*.plan.md`**, or a short **TODO** in the relevant ops doc — not orphan comments.
- Recommended doc owners/follow-ups
- Prefer **project-local** `.cursor/skills/` and this repo's rules/docs
  over duplicating global Cursor defaults.
