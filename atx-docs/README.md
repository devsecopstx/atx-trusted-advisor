# Documentation index (atxFinance)

Engineering and ops docs for **aTx Finance** / `xfinance`. **Canonical tree:** **`atx-docs/`** at repo root (there is no top-level `docs/` folder — update links from older `docs/atx-*` paths accordingly). For Cursor agent skills, see [`.cursor/skills/README.md`](../.cursor/skills/README.md).

---

## Table of contents

- [Backlog](#backlog)
- [Guides](#guides)
- [Frontend plan](#frontend-plan)
- [Operations — sre-ops](#operations-sre-ops)
- [xChat and product — xchat](#xchat-and-product-xchat)
- [Options (RAG + seed)](#options-rag-seed)
- [Diagrams & assets](#diagrams-assets)
- [Audit & governance](#audit-governance)

---

## Backlog

| Doc | Purpose |
|-----|---------|
| [PLAN.md](./PLAN.md) | Canonical backlog: admin/BFF, multi-agent chunks, RAG seed, NL/xOptions, Stripe, deferred work |

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

## Frontend plan

| Doc | Purpose |
|-----|---------|
| [PLAN.md § Stripe & billing](./PLAN.md#stripe-billing-from-frontend-plan) | **Stripe** / billing still open; shipped UI noted by reference only (no separate `frontend-plan.md`) |

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
| [atx-multi-agent.md](./xchat/atx-multi-agent.md) | Multi-agent orchestration, Phase 1 locked decisions (see also [design loop diagram](./xchat/atx-multi-agent-design-loop.mmd)) |
| [atxfinance-tool-stub.md](./xchat/atxfinance-tool-stub.md) | Portfolio / watchlist tool contract |
| [atxfinance-xchat-prompts.md](./xchat/atxfinance-xchat-prompts.md) | xChat prompts |
| [context-routing-multi-agent-policy.md](./xchat/context-routing-multi-agent-policy.md) | Retrieval vs tools vs multi-agent |
| [cursor-cloud-agent-personas.md](./xchat/cursor-cloud-agent-personas.md) | Cursor cloud agent personas |
| [pre-release-check.md](./xchat/pre-release-check.md) | Pre-release xChat checks |
| [xai-api-standard.md](./xchat/xai-api-standard.md) | xAI API usage |
| [xchat-debug-logging.md](./xchat/xchat-debug-logging.md) | Debug logging |
| [xchat-future-tool-loop.md](./xchat/xchat-future-tool-loop.md) | Future tool-loop notes |
| [xchat-tools-guide.md](./xchat/xchat-tools-guide.md) | Tools & prompts |
| [xchat-nl-collect-inputs.md](./xchat/xchat-nl-collect-inputs.md) | **NL** (natural-language) slot collection before options/strategy flows; xChat system copy |
| [xdesign-review-admin-console-ux.md](./xchat/xdesign-review-admin-console-ux.md) | Admin console UX review |
| [xdesign-review-legacy-prompts-inventory.md](./xchat/xdesign-review-legacy-prompts-inventory.md) | Legacy prompts inventory |
| [xfeature-tools-plan.md](./xchat/xfeature-tools-plan.md) | Feature tools plan |
| [xfinance-branding-review.md](./xchat/xfinance-branding-review.md) | Branding review |

---

## Options (RAG + seed)

**Canonical tree (physical):** **[`atx-docs/rag-collection/options-strategy/`](./rag-collection/options-strategy/README.md)** — Markdown narratives ingested with **`npm run seed:admin`** into the xAI trusted-advisor **`…-options-strategy`** segment (see **`scripts/lib/seed-xai-rag-ingest.mjs`**). There is no separate `atx-docs/atx-options/` tree; use this RAG segment + **options-coreskills** below.

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
| [design-system/](./design-system/) | Brand kit CSS/MD/HTML + `design-future-consideration.md` — imported by Next from `src/app/layout.tsx` |

---

## Audit & governance

- **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../.cursor/skills/atxdesign-review-audit/SKILL.md) and [`CHECKLIST.md`](../.cursor/skills/atxdesign-review-audit/CHECKLIST.md)
- **Ground truth:** [audit-lineage-and-controls.md](./sre-ops/audit-lineage-and-controls.md) (Mongo `admin_audit_events`, BFF parity, test inventory, known gaps)

**Doc updates:** follow the [`generate-docs`](../.cursor/skills/generate-docs/SKILL.md) skill when changing APIs or runbooks.
