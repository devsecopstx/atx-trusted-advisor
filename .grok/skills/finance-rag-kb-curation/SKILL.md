---
name: finance-rag-kb-curation
description: Curate and maintain the atx-docs/rag-collection sources that power the shared Finance xAI collection and all finance-advisor / advisor xChat personas. Use when adding strategy content, updating finance-core, adjusting response guidelines, fixing pre-search filters, or running refresh-finance / seed:finance-xai-collection. Trigger: RAG, finance KB, collection seeding, options-strategy doc update.
skill_family: xchat-rag
last_updated: 2026-05-20
---

# finance-rag-kb-curation

Operational expert for the **Finance KB** (the single most important grounding source for your xChat HNWI users).

## What Gets Uploaded (Finance Collection)

The canonical `XAI_FINANCE_COLLECTION_ID` receives (via `seed:finance-xai-collection` or Admin → RAG refresh-finance):

- `atx-docs/rag-collection/options-strategy-core/` (lean desk narratives + `options-coreskills.md`)
- `atx-docs/rag-collection/options-strategy-advanced/` (full multi-leg playbooks)
- `atx-docs/rag-collection/atx-response-guidelines/` (compliance, structure, tone, citations — surface=xchat or doc_type=compliance)
- `atx-docs/rag-collection/finance-core/` (glossary, primitives, risk, tax, behavioral, portfolio-construction, macro, performance, etc.)

**Never** upload the nested `options-strategy/<slug>/` tree here (it is for Mongo `options_strategy` catalog + xOptions only; would duplicate vectors).

## Persona Linkage Contract

Every production persona YAML under `atx-docs/rag-collection/xpersonas/*/ ` declares in `always_include`:

- `atx-rag-collection/finance-core/**`
- `atx-rag-collection/atx-response-guidelines/**`
- `atx-rag-collection/options-strategy-core/**`
- `atx-rag-collection/options-strategy-advanced/**` (for advisor/finance-advisor when depth needed)

The runtime (`resolveXchatPersonaDeclaredCollectionIds`) resolves only the Finance collection id + persona-declared extras (max 2 total). Legacy per-env bucket fields are ignored.

## Pre-Search Filters (AIP-160) Used by xChat Ask

Server-side before the model sees the turn (see `searchFinanceKbCollectionForXchatPreRag` and xchat-tools-guide):

1. **Guidelines leg**: `(surface = "xchat" OR doc_type = "compliance")`
2. **Options leg**: `(category = "options-strategy-core" OR category = "options-strategy-advanced") AND complexity = "core"` (or "advanced") + optional `strategy_type = "..." AND risk_level = "balanced"`

Fall back to unfiltered search on error or empty results. Model `file_search` calls should receive matching `filter` strings when the wire supports it.

## Content Standards (from options-coreskills.md)

Every new or edited narrative must answer the 10-point review framework in order (see hnwi-xchat-finance-advisor skill for the list). Frontmatter must include at minimum:

- `id`, `name`, `description`
- `strategy_type`, `risk_level` (conservative|balanced|aggressive), `complexity` (core|advanced), `underlying_type`
- `tags` array (desk_reference, skill_map, etc.)

Use `xfinance-strategy-*` ids consistently with the map in `options-coreskills.md`.

## Ops Commands & Verification

- `npm run seed:finance-xai-collection` (or `POST /api/admin/rag/refresh-finance`)
- After upload: poll readiness, then smoke `POST /api/xchat/ask` (as global_admin or app user with the persona) asking a question answerable only from the new chunk.
- Verify fewer tool calls on pure-playbook questions.
- One-time repair for persona rows: `npm run ops:migrate:xchat-personas-finance-collection -- --execute`

## Guardrails

- Keep logical paths in YAML as `atx-rag-collection/...` (the seed scripts map them).
- Do not duplicate full narrative text into Mongo `xchat_rag_chunks` (RAG source of truth is the xAI collection).
- When adding HNWI-specific topics (tax, estate, concentration, rebalancing), place under `finance-core/` with appropriate frontmatter tags and update the glossary if new terms appear.
- After structural changes, update `options-coreskills.md` strategy map + this skill + the persona YAMLs.

## Related Source Locations

- `atx-docs/rag-collection/rag-collection.md` and `README.md` (top-level ingest rules)
- `atx-docs/rag-collection/options-strategy-xchat-seeding.md` (cost-aware rationale)
- `atx-docs/xchat/xchat-tools-guide.md` § "Finance KB metadata filters"
- `scripts/` for the actual seed/refresh implementations
- `atx-docs/sre-ops/` for any backend collection sync jobs

## Output When Using This Skill

- Clear "add this file with this exact frontmatter + 10-point structure" guidance.
- AIP-160 filter strings ready to paste.
- Verification command sequence + expected RAG hit / tool-call reduction.
- Cross-links updated in `options-coreskills.md`, persona YAMLs, and release notes when appropriate.
