# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor subagents (those live under **`.cursor/agents/*.md`** per [Subagents](https://cursor.com/docs/subagents)).

## Table of contents

- [Purpose by segment](#purpose-by-segment)
- [RAG path layout](#rag-path-layout)
- [Segment file listing](#segment-file-listing)
  - [xpersonas](#xpersonas)
  - [example-prompts](#example-prompts)
  - [options-strategy](#options-strategy) (Mongo catalog, nested)
  - [options-strategy-core](#options-strategy-core) (Finance KB, lean)
  - [options-strategy-advanced](#options-strategy-advanced) (Finance KB, full playbooks)
  - [atx-response-guidelines](#atx-response-guidelines) (Finance KB, response framing)
  - [finance-core](#finance-core) (Finance KB, cross-cutting desk literacy)
- [Persona YAML schema](#persona-yaml-schema)
- [Hygiene](#hygiene)
- [Tests and automation](#tests-and-automation)
- [Docs parity](#docs-parity)

---

## Purpose by segment

| Segment | xAI collection suffix (after `atx-trusted-advisor-<dev|stage|prod>-`) | Role |
| --- | --- | --- |
| **`xpersonas/`** | `xpersonas` | xPersona seed specs — **exactly one `*.yaml` per subfolder** (Mongo via **`npm run seed:xpersonas`** / **`seed:admin`**; no `.md` in this segment). **`seed:admin` does not upload** YAML to xAI; team KB is out-of-band if needed (**`scripts/lib/seed-xai-rag-ingest.mjs`** is library-only). |
| **`example-prompts/`** | `example-prompts` | Example user prompts / scenario copy for UX and KB samples. |
| **`options-strategy/`** | `options-strategy` | **Mongo-only** seed: nested `slug/slug.md` narratives for **`options_strategy`** / admin xOptions catalog (**`npm run seed:options-strategy*`**). **Not** uploaded by **`refresh-finance`** (use **core** + **advanced** for xAI). |
| **`options-strategy-core/`** | *(uploaded as part of shared Finance collection)* | Lean options desk copy + **[`options-coreskills.md`](./options-strategy-core/options-coreskills.md)** — **`finance-advisor`** `always_include` **only** (not advanced). |
| **`options-strategy-advanced/`** | *(same)* | Full multi-leg / overlay playbooks — **`advisor`** `always_include` **only** (not core). |
| **`atx-response-guidelines/`** | *(same)* | xChat/report response structure, citations, tone, compliance — uploaded with **`refresh-finance`**; all shipped **`xpersonas/*.yaml`** include **`atx-rag-collection/atx-response-guidelines/**`** and **`atx-rag-collection/finance-core/**`** in **`always_include`** (**`advisor`** / **`finance-advisor`** also list their **`options-strategy-*`** slice). |
| **`finance-core/`** | *(same)* | Cross-cutting primitives, risk education, short desk refs + small PDFs, HNWI glossary — flat **`*.md`** at segment root plus optional **topic subfolders** (HNWI series) and **`stem/stem.pdf`** folders; see **[`README.md`](./finance-core/README.md)**. |

Legacy repo folders **`personas-trusted-family`**, **`xchat-example-prompts`**, **`atx-personas-trusted-family`**, **`atx-xchat-example-prompts`**, **`atx-options-strategy`** are still **ingest path fallbacks** (see seed script).

---

## RAG path layout

**Rule (default):** For most segments, each ingestible file lives at **`…/<segment>/<stem>/<stem>.<ext>`** — **directory name equals filename stem** (e.g. `wheel/wheel.md`, `example-prompts/example-prompts/example-prompts.md`, `options-risks-toc_supplement/options-risks-toc_supplement.pdf`). **`options-strategy-core`**, **`options-strategy-advanced`**, and **`atx-response-guidelines`** use flat **`*.md`** at the segment root for a smaller Finance KB upload surface (validated in **`tests/unit/atx-rag-collection-layout.test.ts`**). **`finance-core`** keeps **flat primer `*.md`** at the root **and** optional **nested topic `*.md`** (e.g. `finance-core/tax-strategies/…`) plus **`stem/stem.pdf`** PDF folders.

**xpersonas:** Each subfolder holds **exactly one** persona `*.yaml`. Many personas use **`folder/folder.yaml`** (folder name equals file stem), e.g. `advisor/advisor.yaml`, `exam-coach/exam-coach.yaml`, `quant-trader/quant-trader.yaml`. Others use a **suffix stem** under a short bucket, e.g. `legal/legal-advisor.yaml`, `tax-expert/atx-tax-expert-advisor.yaml`. This segment is **YAML-only** so Grok-facing persona specs stay consistent with `seed:xpersonas` and admin governance.

Segment-level **`README.md`** files are for humans; ingest skips lowercase `readme.md` by name.

**Why:** Upload logical names derive from relative paths; stable paths improve RAG tags and indexing.

---

## Segment file listing

### xpersonas

| Path | Notes |
| --- | --- |
| `advisor/advisor.yaml` | Persona spec (global-admin default **Advisor** seed) |
| `exam-coach/exam-coach.yaml` | Persona spec |
| `finance-advisor/finance-advisor.yaml` | Persona spec |
| `legal/legal-advisor.yaml` | Persona spec |
| `quant-trader/quant-trader.yaml` | Persona spec (Monte Carlo tail-risk, quant desk) |
| `tax-expert/atx-tax-expert-advisor.yaml` | Persona spec |

### example-prompts

| Path |
| --- |
| `example-prompts/example-prompts/example-prompts.md` |

### options-strategy

| Path |
| --- |
| [`README.md`](./options-strategy/README.md) (docs only; not ingested as content) |
| `bull-call-debit-spread/bull-call-debit-spread.md` |
| `bull-put-credit-spread/bull-put-credit-spread.md` |
| `calendar-spread/calendar-spread.md` |
| `cash-secured-puts/cash-secured-puts.md` |
| `covered-calls/covered-calls.md` |
| `diagonal-spread/diagonal-spread.md` |
| `iron-condor/iron-condor.md` |
| `leap-call-cc-overlay/leap-call-cc-overlay.md` |
| `poor-mans-covered-call/poor-mans-covered-call.md` |
| `wheel/wheel.md` |

### options-strategy-core

| Path |
| --- |
| [`options-coreskills.md`](./options-strategy-core/options-coreskills.md) (canonical index — **★**) |
| `covered-call-and-csp.md`, `wheel-strategy.md`, `iron-condor-jade-lizard.md`, plus supplementary flat stems (earnings, sizing, tax, vol, straddle/strangle) |

### options-strategy-advanced

| Path |
| --- |
| `bull-call-debit-spread.md`, `bull-put-credit-spread.md`, `calendar-spread.md`, `diagonal-spread.md`, `iron-condor.md`, `leap-call-cc-overlay.md`, `poor-mans-covered-call.md`, `ratio-spread.md`, `broken-wing-butterfly.md`, `zebra.md` |

### atx-response-guidelines

| Path |
| --- |
| `citation-format.md`, `compliance-disclaimers.md`, `report-structure.md`, `response-structure.md`, `tone-and-framing.md` |

### finance-core

| Path | Notes |
| --- | --- |
| [`README.md`](./finance-core/README.md) | Segment index |
| `primitives-and-mechanics.md` | Orders, settlement, margin, chains/quotes |
| `risk-and-product-education.md` | IV/OI, assignment, risk primers |
| `short-desk-references.md` | PDF pointers (e.g. `options-risks-toc_supplement.pdf`) |
| `glossary-hnwi-desk-101.md` | Reusable desk vocabulary |
| `portfolio-construction/*.md`, `risk-management/*.md`, `asset-allocation/*.md`, `tax-strategies/*.md`, `macro-outlooks/*.md`, `behavioral-finance/*.md`, `legacy-estate/*.md`, `rebalancing-mechanics/*.md`, `performance-reporting/*.md`, `custom-db-integrations/*.md` | HNWI desk series + meta grounding |
| `options-risks-toc_supplement/options-risks-toc_supplement.pdf` | Small reference PDF (stem/stem layout) |

---

## Persona YAML schema

These **YAML** specs are **xPersona / RAG seeds** only. They are **not** Cursor subagents (`.cursor/agents/*.md`). Field names (`id`, `description`, `INSTRUCTIONS`, …) are a separate contract from Subagent frontmatter.

| Key | Notes |
| --- | --- |
| Top comment | First line: `# atx-rag-collection/xpersonas/<bucket>/<file>.yaml` — **logical RAG path tag** (matches ingest-relative naming), not the on-disk folder alias |
| `id` / `name` | Stable persona slug for Mongo / product (may differ from folder name) |
| `description` | Block scalar; product-facing summary |
| `icon` / `color` | Optional on agents; **required** here for admin/UI parity |
| `INSTRUCTIONS` | Bullet list for operator / ingest hints |
| `setup` | Shell one-liner; `test -f` must use the **filesystem** path from repo root, e.g. `atx-docs/rag-collection/xpersonas/<bucket>/<file>.yaml` (some older specs still use the legacy `atx-rag-collection/...` spelling — prefer `atx-docs/rag-collection/...` for a real `test -f`) |
| `model` | Default chat model id (e.g. `grok-4-1-fast-reasoning`); app may override via env |
| `system_prompt` | Block scalar; runtime persona body |
| `xai_collection_name` | Optional. xAI **display name** to match (case-insensitive) for `xchat_personas.xaiCollection.collectionId`. Default: **`atx-trusted-advisor-{dev|stage|prod}-xpersonas`** (same deploy slug as `resolveTrustedAdvisorDeploySlug` / RAG ingest). |
| `override_prompt` | Optional; maps to Mongo `overridePrompt` (default empty). |
| `enable_rag` | Optional boolean (default `true`) → `enableRag`. |
| `default_scope` | Optional string (default `global`) → `defaultScope`. |
| `xapi` | Optional; partial xAPI config. If omitted, **`npm run seed:xpersonas`** builds tools like Super-Agent (`collections_search` when a collection id resolves). |
| `temperature` | Optional number in `[0, 1]` (default `0.2`). |
| `always_include` | Repo paths under `atx-rag-collection/` (or other in-repo globs), not `.cursor/` |
| `never_include` | Standard excludes: `node_modules/`, `.next/`, `dist/`, `"**/*.log"` |
| `commands` | Short echo hints for UX / docs (optional extensions per persona) |

Cursor agents may include **`worktree:`**; persona specs omit it.

### Mongo sync (`seed:xpersonas`)

- **Command:** `npm run seed:xpersonas` (`scripts/sync-xpersonas-from-yaml.ts`, `node --env-file=.env --import tsx`).
- **`seed:admin`:** After core Mongo upserts (tenant, user, portfolio, **`admin_user_settings`**), runs the same sync (unless **`SKIP_SEED_XPERSONAS`**), then re-reads the global-admin default persona (**Advisor**, **`nameNormalized` `advisor`**) for the summary payload and to backfill **`assignedPersonaId`** if still empty — so **`/admin/personas`** stays aligned with disk YAML without a second command. Legacy DBs may still reference **`super-agent`**; operators migrate via normal persona sync and admin settings.
- **Ordering:** For `file_search` against **`…-xpersonas`**, populate xAI team collections **outside** `seed:admin`. Run **`npm run seed:xpersonas`** / **`seed:admin`** for Mongo; xAI upload is a separate step if your deployment requires it.
- **`SEED_XPERSONAS_MODE`:** **`merge`** (default) fills missing `xaiCollection.collectionId` and appends `xapi.tools` by `type` without overwriting prompts or existing tool payloads. **`replace`** overwrites prompts, scalars, and `xapi`; keeps `status` / `version` / `publishedAt`; sets `xaiCollection` only when a collection id resolves.
- **Flags:** **`SKIP_SEED_XPERSONAS`**, production **`replace`** + **`SEED_XPERSONAS_STRICT=1`** — see **`DEVELOPMENT.md`** (RAG / seed notes).

---

## Hygiene

- One canonical paragraph per idea — no duplicate blocks in a single file.
- Keep shared-repo copy **generic** (no real names, private budgets, or PII).
- Prefer PDF filenames **without spaces** when adding new docs (existing `Series 65-LEM-12E` path is grandfathered).

---

## Tests and automation

- **`seed:admin`** loads disk specs into **Mongo** from **`atx-docs/rag-collection/`** (legacy **`atx-rag-collection/`** still supported for options-strategy sync paths). Team xAI upload is **not** part of seed; see **`scripts/lib/seed-xai-rag-ingest.mjs`** for optional library use. Layout tests: **`tests/unit/atx-rag-collection-layout.test.ts`**.

---

## Docs parity

- **`generate-docs`** § *RAG collection sources* — update when folders or seed contract change.
- **Runtime model** for app personas follows **`XAI_CHAT_MODEL`** (default **`grok-4-1-fast-reasoning`** in **`.env.example`**).
- Engineering index: **`atx-docs/README.md`** (options narratives + links into this tree).
