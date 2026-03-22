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
- `DEVELOPMENT.md`: full setup, required env keys, runbooks, API map.
- `.env.example`: empty `KEY=` lines and required key names only
  (no credential-shaped placeholders).
- `AGENTS.md`: operator-centric commands/checks and troubleshooting.
- `CONTRIBUTING.md`: local validation + PR quality gates.

When introducing new subsystems, prefer extending `DEVELOPMENT.md`
and linking from `README.md` instead of creating scattered top-level docs.

**xChat / branding:** Keep **`docs/xchat/xfinance-branding-review.md`**
in sync when **`xfinance-branding.mdc`** or logo/hero/pricing messaging
changes materially.

**xChat / observability:** When changing **`ENABLE_XCHAT_DEBUG`**,
**`src/lib/xchat-debug.ts`**, or ask/batch logging prefixes, update
**`docs/xchat/xchat-debug-logging.md`**
(`type` taxonomy, values, privacy).
If `GET /api/xchat/history` or `GET /api/xchat/history/stats` logging changes,
include `xchat_history_list` / `xchat_history_stats` in the taxonomy docs.

**xChat / tools & prompts:** When changing `POST /api/xchat/ask` prompt assembly,
`respondWithXaiToolLoop`, `personaXapiToolsToXaiRequestTools`, workspace snapshot,
batch persona parity, or RAG/tool routing, update **`docs/xchat/xchat-tools-guide.md`**
(mermaid workflow + tables).

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

**xStrategyBuilder / strategy-options (Yahoo option chain):** When changing
`GET /api/strategy-options`, `GET /api/strategy-options/expirations`, UI under
`/xstrategybuilder/strategy-options`, or **`src/modules/strategy-options/**`**:

- Update **`DEVELOPMENT.md`** (xStrategyBuilder options chain subsection).
- Update **`README.md`** Core Routes (UI + API lines).
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
  **`docs/xchat/xfinance-branding-review.md`** for logo/hero/design-system
  alignment with the rule. Link or summarize rule updates there when it is
  the stakeholder-facing explainer.
- Do **not** duplicate conflicting pricing:
  shipped UI keeps **$2/hr** on primary surfaces; roadmap subscription tiers
  stay secondary (deck/waitlist) until productized.

### Branding assets folder gaps (`branding/`)

When files under **`branding/`** are added, replaced, or deleted:

- Update **`branding/README.md`** if the asset set, naming convention, or
  "how to use" workflow changed.
- Record a quick QA pass in **`branding/atxfinance-brand-validation.md`**
  (or link equivalent review output) for non-trivial creative refreshes.
- If deletions are intentional, note rationale in PR summary and ensure
  no docs/rules still reference removed filenames.
- Keep generated assets and source prompts consistent:
  if prompt taxonomy changes, sync
  `branding/atxfinance-brand-prompts.md` and
  `branding/atxfinance-branding-tags.md`.

## PR review handoff

For combined Core MVP + Branding PRs, the final gate sequence lives in
**`xdesign-review`** (reviewer order + production deploy lock).
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
  `src/modules/xchat/**`, `docs/xchat/**`.
  Do not use other monorepo layouts.
- **Drift:** if a rule references APIs or folders that moved,
  update the rule in the same PR as the code move.

### When to document

- New or heavily updated `.mdc` files:
  add a **one-line pointer** in `DEVELOPMENT.md` or `AGENTS.md`
  under Cursor/agent setup *if* operators need discovery.
  Otherwise, the rule is self-describing via `description` + `globs`.
- xChat-specific product/agent notes stay in **`docs/xchat/`**;
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
  - `.cursor/skills/test-commit-push/SKILL.md`
  - `.cursor/skills/test-commit-push/CHECKLIST.md`
  - `.cursor/skills/test-automation/SKILL.md` (when adding or scoping tests)
  - `.cursor/skills/xdesign-review/SKILL.md`
    (combined MVP + branding + pre-prod lock)
  - `AGENTS.md`
- Rule changes under `.cursor/rules/` ship with the same validation pass
  as skills (see test-commit-push checklist).

## Deploy / secrets doc parity (xFinance)

When `.github/workflows/deploy-cloud-run.yml` changes
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
7. Document workflow-dispatch input contract for production runs:
   `target=production` + `approval=approve-production`; note that wrong inputs
   can produce fully skipped deploy runs.
8. Keep staging/prod job gating rules documented when workflow conditions change
   (for example, staging should run on main push or explicit staging target, not
   on production-only dispatches).

## xChat prompt docs parity

When updating prompt tips/chips or persona examples in xChat:

1. Keep **`docs/xchat/atxfinance-xchat-prompts.md`** in sync with the actual
   UI surface (`src/app/xchat/ui/xchat-conversation.tsx`).
2. Do not document persona chips that are not currently rendered.
3. If prompts are "planned" and not shipped, label them as backlog/TODO and
   keep shipped behavior first.

## Output

- Docs updated/created
- Coverage gaps still open:
  prefer capturing non-blocking items in **`docs/PLAN.md`**
  (TODO / design TBD) instead of orphan comments
- Recommended doc owners/follow-ups
- Prefer **project-local** `.cursor/skills/` and this repo's rules/docs
  over duplicating global Cursor defaults.
