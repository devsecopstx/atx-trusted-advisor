# Documentation index (atxFinance)

Engineering and ops docs for **aTx Finance** / `xfinance`. **Canonical tree:** **`atx-docs/`** at repo root (there is no top-level `docs/` folder — update links from older `docs/atx-*` paths accordingly). For Cursor agent skills, see [`.cursor/skills/README.md`](../.cursor/skills/README.md).

---

## Table of contents

- [Architecture & shipped stack](#architecture-shipped-stack)
- [Backlog](#backlog)
- [Guides](#guides)
- [Operations — sre-ops](#operations-sre-ops)
- [xChat and product — xchat](#xchat-and-product-xchat)
- [Options (RAG + seed)](#options-rag-seed)
- [Diagrams & assets](#diagrams-assets)
- [Audit & governance](#audit-governance)

---

## Architecture & shipped stack

| Doc | Purpose |
|-----|---------|
| **[current-state-features.md](./design-system/current-state-features.md)** | **Single consolidated technical architecture** for the monorepo (Next + Spring + Mongo + integrations), shipped product surfaces, CI/test matrix, pre-prod release gate, and known doc/test gaps — deep dives stay in linked `atx-docs/*` files; open work stays in [PLAN.md](./PLAN.md) |
| **[tenant-ux-plan.md](./design-system/tenant-ux-plan.md)** | **Tenant UX (`tenant_ux`):** per-role app routes, default landing, catalog JSON + admin export API; backlog for Mongo + admin UI + enforcement |

---

## Backlog

| Doc | Purpose |
|-----|---------|
| [PLAN.md](./PLAN.md) | Canonical backlog: admin/BFF, multi-agent chunks, RAG seed, NL/xOptions, deferred work |

---

## Guides

| Doc | Purpose |
|-----|---------|
| [guides/README.md](./guides/README.md) | Split guide index extracted from `DEVELOPMENT.md` |
| [guides/local-development.md](./guides/local-development.md) | Local setup, env keys, Mongo/backend/frontend run order, validation |
| [guides/auth-and-access.md](./guides/auth-and-access.md) | Roles, access request lifecycle, OAuth/app_user troubleshooting |
| [guides/api-endpoints.md](./guides/api-endpoints.md) | API route inventory by domain + OpenAPI validation checklist |
| [guides/xchat-personas.md](./guides/xchat-personas.md) | xChat route behavior, persona governance, collection/seed notes |
| [guides/deploy-and-ops.md](./guides/deploy-and-ops.md) | Deploy/rollback model, secrets source of truth, operator checks |

---

## Operations — sre-ops

| Doc | Purpose |
|-----|---------|
| [api-consolidation-spring-backend.md](./sre-ops/api-consolidation-spring-backend.md) | BFF migration, Spring parity, side-effect checklist |
| [atxfinance-backend-http-api.md](./sre-ops/atxfinance-backend-http-api.md) | Kotlin HTTP surface (BFF contract) |
| [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) | Audit rows, BFF audit parity, gaps vs **xdesign-review-audit** |
| [auth-oauth-spring-dual-run.md](./sre-ops/auth-oauth-spring-dual-run.md) | OAuth callback cutover, Next vs Spring gaps, dual-run checklist |
| [bff-admin-backlog.md](./sre-ops/bff-admin-backlog.md) | Admin/BFF backlog notes |
| [bff-enable-staging-runbook.md](./sre-ops/bff-enable-staging-runbook.md) | Enable BFF proxy on staging |
| [junie-guidelines-atxfinance-backend.md](./sre-ops/junie-guidelines-atxfinance-backend.md) | Kotlin backend guidelines |
| [secret-rotation.md](./sre-ops/secret-rotation.md) | Secret rotation |
| [x-oauth-atx-callbacks.md](./sre-ops/x-oauth-atx-callbacks.md) | X OAuth callbacks |

---

## xChat and product — xchat

| Doc | Purpose |
|-----|---------|
| [atx-multi-agent.md](./xchat/atx-multi-agent.md) | **xChat Hardcore** / Phase 1 multi-agent orchestration, locked decisions (see [PLAN.md](./PLAN.md) § xChat Hardcore; [design loop diagram](./xchat/atx-multi-agent-design-loop.mmd)) |
| [atxfinance-tool-stub.md](./xchat/atxfinance-tool-stub.md) | Portfolio / watchlist tool contract |
| [atxfinance-xchat-prompts.md](./xchat/atxfinance-xchat-prompts.md) | xChat prompts |
| [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md) | Retrieval vs tools vs multi-agent |
| [cursor-cloud-agent-personas.md](./xchat/cursor-cloud-agent-personas.md) | Cursor cloud agent personas |
| [pre-release-check.md](./xchat/pre-release-check.md) | Pre-release xChat checks |
| [xai-api-standard.md](./xchat/xai-api-standard.md) | xAI API usage |
| [xchat-debug-logging.md](./xchat/xchat-debug-logging.md) | Debug logging |
| [xchat-future-tool-loop.md](./xchat/xchat-future-tool-loop.md) | Future tool-loop notes |
| [xchat-tools-guide.md](./xchat/xchat-tools-guide.md) | Tools & prompts |
| [xchat-history-storage.md](./xchat/xchat-history-storage.md) | Where xChat history lives (Mongo vs xAI); deprecated `ATXFINANCE_COLLECTION_ID` |
| [xchat-voice-mode.md](./xchat/xchat-voice-mode.md) | Dictation (STT) vs Voice Mode (realtime); routes, WS, tests |
| [xchat-hnwi-templates-ui.md](./xchat/xchat-hnwi-templates-ui.md) | HNWI **Templates** gallery + persona popover (PLAN **707**) |
| [xchat-nl-collect-inputs.md](./xchat/xchat-nl-collect-inputs.md) | **NL** (natural-language) slot collection before options/strategy flows; xChat system copy |
| [xdesign-review-admin-console-ux.md](./xchat/xdesign-review-admin-console-ux.md) | Admin console UX review |
| [xdesign-review-legacy-prompts-inventory.md](./xchat/xdesign-review-legacy-prompts-inventory.md) | Legacy prompts inventory |
| [xfeature-tools-plan.md](./xchat/xfeature-tools-plan.md) | Feature tools plan |
| [xfinance-branding-review.md](./xchat/xfinance-branding-review.md) | Branding review |

---

## Options (RAG + seed)

**Canonical tree (physical):** **[`atx-docs/rag-collection/options-strategy/`](./rag-collection/options-strategy/README.md)** — Markdown narratives sync to Mongo with **`seed:admin`** / **`seed:options-strategy-*`**. **`seed:admin` does not upload** to xAI team collections; populate team KB separately if you need `file_search` on those files (**`scripts/lib/seed-xai-rag-ingest.mjs`** is library-only, not invoked by seed). There is no separate `atx-docs/atx-options/` tree; use this RAG segment + **options-coreskills** below.

**Reviewer / agent quick index:** **[`options-coreskills.md`](./rag-collection/options-strategy/options-coreskills/options-coreskills.md)** — **`xfinance-strategy-*` id**, narrative path, **risk** & **outlook**, links to **`.cursor/skills/skill-*/SKILL.md`**.

| Doc | Purpose |
|-----|---------|
| **[options-coreskills.md](./rag-collection/options-strategy/options-coreskills/options-coreskills.md)** | **★ Canonical index:** strategy ↔ narrative ↔ **risk** ↔ **outlook** ↔ id ↔ Cursor skill |
| **[options-strategy README](./rag-collection/options-strategy/README.md)** | Segment entry + layout rule |
| *(no `atx-options/` stub)* | Options docs live under **`atx-docs/rag-collection/options-strategy/`** + **options-coreskills** |
| **[RAG collection README](./rag-collection/README.md)** | Full segment TOC + RAG folder convention |

**Folder convention (logical tag in files):** `atx-rag-collection/options-strategy/<slug>/<slug>.md` — the first-line tag stays the same for stable RAG paths; physical files live under `atx-docs/rag-collection`. Frontmatter `xfinance-strategy-*`. Full playbooks: `.cursor/skills/skill-*/SKILL.md`. 

**Legacy paths:** Older docs referred to **`atx-options-strategy/`** and **`atx-options-coreskills.md`**; the repo canonical names are **`options-strategy/`** and **`options-coreskills/options-coreskills.md`**.

---

## Diagrams & assets

| File | Purpose |
|------|---------|
| [atx-multi-agent-design-loop.mmd](./xchat/atx-multi-agent-design-loop.mmd) | Multi-agent flow (Mermaid) |
| [super-agent-model157.mmd](./xchat/super-agent-model157.mmd) | Super-agent diagram (Mermaid) |
| [branding/](./branding/) | Brand prompts, palette, marketing copy (reference assets) |
| [design-system/](./design-system/) | Brand kit CSS/MD/HTML — imported by Next from `src/app/layout.tsx`; UX roadmap lives in [PLAN.md](./PLAN.md#design-and-ux-roadmap) |
| [charts-apex.md](./design-system/charts-apex.md) | ApexCharts on xStrategyBuilder / xOptions; Chart.js removed |

---

## Audit & governance

- **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../.cursor/skills/atxdesign-review-audit/SKILL.md) and [`CHECKLIST.md`](../.cursor/skills/atxdesign-review-audit/CHECKLIST.md)
- **Ground truth:** [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) (Mongo `admin_audit_events`, BFF parity, test inventory, known gaps)

**Doc updates:** follow [`test-commit-push`](../.cursor/skills/test-commit-push/SKILL.md) (and [`.cursor/agents/reviewer.md`](../.cursor/agents/reviewer.md)) when changing APIs or runbooks.
