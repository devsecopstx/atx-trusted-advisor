# Documentation index (atxFinance)

Engineering and ops docs for **aTx Finance** / `xfinance`. **Canonical tree:** **`atx-docs/`** at repo root (there is no top-level `docs/` folder — update links from older `docs/atx-*` paths accordingly). For Cursor agent skills, see [`.cursor/skills/README.md`](../.cursor/skills/README.md).

---

## Table of contents

- [Backlog](#backlog)
- [Frontend plan](#frontend-plan)
- [Operations — atx-sre-ops](#operations--atx-sre-ops)
- [xChat and product — atx-xchat](#xchat-and-product--atx-xchat)
- [Options (RAG + seed)](#options-rag-seed)
- [Diagrams & assets](#diagrams--assets)
- [Audit & governance](#audit--governance)

---

## Backlog

| Doc | Purpose |
|-----|---------|
| [PLAN.md](./PLAN.md) | Canonical backlog: admin/BFF, multi-agent chunks, RAG seed, NL/xOptions, Stripe, deferred work |

---

## Frontend plan

| Doc | Purpose |
|-----|---------|
| [frontend-plan.md](./frontend-plan.md) | Pointer to **PLAN.md**; **Stripe** / billing still open; shipped UI noted by reference only |

---

## Operations — atx-sre-ops

| Doc | Purpose |
|-----|---------|
| [api-consolidation-spring-backend.md](./atx-sre-ops/api-consolidation-spring-backend.md) | BFF migration, Spring parity, side-effect checklist |
| [atxfinance-backend-http-api.md](./atx-sre-ops/atxfinance-backend-http-api.md) | Kotlin HTTP surface (BFF contract) |
| [audit-lineage-and-controls.md](./atx-sre-ops/audit-lineage-and-controls.md) | Audit rows, BFF audit parity, gaps vs **xdesign-review-audit** |
| [auth-oauth-spring-dual-run.md](./atx-sre-ops/auth-oauth-spring-dual-run.md) | OAuth callback cutover, Next vs Spring gaps, dual-run checklist |
| [bff-admin-backlog.md](./atx-sre-ops/bff-admin-backlog.md) | Admin/BFF backlog notes |
| [bff-enable-staging-runbook.md](./atx-sre-ops/bff-enable-staging-runbook.md) | Enable BFF proxy on staging |
| [junie-guidelines-atxfinance-backend.md](./atx-sre-ops/junie-guidelines-atxfinance-backend.md) | Kotlin backend guidelines |
| [secret-rotation.md](./atx-sre-ops/secret-rotation.md) | Secret rotation |
| [x-oauth-atx-callbacks.md](./atx-sre-ops/x-oauth-atx-callbacks.md) | X OAuth callbacks |

---

## xChat and product — atx-xchat

| Doc | Purpose |
|-----|---------|
| [atx-multi-agent.md](./atx-xchat/atx-multi-agent.md) | Multi-agent orchestration, Phase 1 locked decisions (see also [design loop diagram](./atx-xchat/atx-multi-agent-design-loop.mmd)) |
| [atxfinance-tool-stub.md](./atx-xchat/atxfinance-tool-stub.md) | Portfolio / watchlist tool contract |
| [atxfinance-xchat-prompts.md](./atx-xchat/atxfinance-xchat-prompts.md) | xChat prompts |
| [context-routing-multi-agent-policy.md](./atx-xchat/context-routing-multi-agent-policy.md) | Retrieval vs tools vs multi-agent |
| [cursor-cloud-agent-personas.md](./atx-xchat/cursor-cloud-agent-personas.md) | Cursor cloud agent personas |
| [pre-release-check.md](./atx-xchat/pre-release-check.md) | Pre-release xChat checks |
| [xai-api-standard.md](./atx-xchat/xai-api-standard.md) | xAI API usage |
| [xchat-debug-logging.md](./atx-xchat/xchat-debug-logging.md) | Debug logging |
| [xchat-future-tool-loop.md](./atx-xchat/xchat-future-tool-loop.md) | Future tool-loop notes |
| [xchat-tools-guide.md](./atx-xchat/xchat-tools-guide.md) | Tools & prompts |
| [xchat-nl-collect-inputs.md](./atx-xchat/xchat-nl-collect-inputs.md) | **NL** (natural-language) slot collection before options/strategy flows; xChat system copy |
| [xdesign-review-admin-console-ux.md](./atx-xchat/xdesign-review-admin-console-ux.md) | Admin console UX review |
| [xdesign-review-legacy-prompts-inventory.md](./atx-xchat/xdesign-review-legacy-prompts-inventory.md) | Legacy prompts inventory |
| [xfeature-tools-plan.md](./atx-xchat/xfeature-tools-plan.md) | Feature tools plan |
| [xfinance-branding-review.md](./atx-xchat/xfinance-branding-review.md) | Branding review |

---

## Options (RAG + seed)

**Canonical tree:** **[`atx-rag-collection/options-strategy/`](../atx-rag-collection/options-strategy/README.md)** — Markdown narratives ingested with **`npm run seed:admin`** into the xAI trusted-advisor **`…-options-strategy`** segment (see **`scripts/lib/seed-xai-rag-ingest.mjs`**). **`atx-docs/atx-options/README.md`](./atx-options/README.md)** is a short stub pointing here.

**Reviewer / agent quick index:** **[`options-coreskills.md`](../atx-rag-collection/options-strategy/options-coreskills/options-coreskills.md)** — **`xfinance-strategy-*` id**, narrative path, **risk** & **outlook**, links to **`.cursor/skills/atx-skill-*/SKILL.md`**.

| Doc | Purpose |
|-----|---------|
| **[options-coreskills.md](../atx-rag-collection/options-strategy/options-coreskills/options-coreskills.md)** | **★ Canonical index:** strategy ↔ narrative ↔ **risk** ↔ **outlook** ↔ id ↔ Cursor skill |
| **[options-strategy README](../atx-rag-collection/options-strategy/README.md)** | Segment entry + layout rule |
| [atx-options stub](./atx-options/README.md) | Redirect → RAG tree |
| **[atx-rag-collection README](../atx-rag-collection/README.md)** | Full segment TOC + RAG folder convention |

**Folder convention (RAG tags):** `atx-rag-collection/options-strategy/<slug>/<slug>.md` — **folder name must equal the markdown stem** (same rule for PDFs/persona YAML under other segments). Frontmatter `xfinance-strategy-*`. Full playbooks: `.cursor/skills/atx-skill-*/SKILL.md`.

**Legacy paths:** Older docs referred to **`atx-options-strategy/`** and **`atx-options-coreskills.md`**; the repo canonical names are **`options-strategy/`** and **`options-coreskills/options-coreskills.md`**.

---

## Diagrams & assets

| File | Purpose |
|------|---------|
| [atx-multi-agent-design-loop.mmd](./atx-xchat/atx-multi-agent-design-loop.mmd) | Multi-agent flow (Mermaid) |
| [super-agent-model157.mmd](./atx-xchat/super-agent-model157.mmd) | Super-agent diagram (Mermaid) |
| [atx-branding/](./atx-branding/) | Brand prompts, palette, marketing copy (reference assets) |
| [design-system/](./design-system/) | Brand kit CSS/MD/HTML + `design-future-consideration.md` — imported by Next from `src/app/layout.tsx` |

---

## Audit & governance

- **Audit skill:** [`.cursor/skills/atxdesign-review-audit/SKILL.md`](../.cursor/skills/atxdesign-review-audit/SKILL.md) and [`CHECKLIST.md`](../.cursor/skills/atxdesign-review-audit/CHECKLIST.md)
- **Ground truth:** [audit-lineage-and-controls.md](./atx-sre-ops/audit-lineage-and-controls.md) (Mongo `admin_audit_events`, BFF parity, test inventory, known gaps)

**Doc updates:** follow the [`generate-docs`](../.cursor/skills/generate-docs/SKILL.md) skill when changing APIs or runbooks.
