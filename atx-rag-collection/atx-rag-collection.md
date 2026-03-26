# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor subagents (those live under **`.cursor/agents/*.md`** per [Subagents](https://cursor.com/docs/subagents)).

## Table of contents

- [Purpose by segment](#purpose-by-segment)
- [RAG path layout](#rag-path-layout)
- [Segment file listing](#segment-file-listing)
  - [xpersonas](#xpersonas)
  - [finance-reference-docs](#finance-reference-docs)
  - [example-prompts](#example-prompts)
  - [options-strategy](#options-strategy)
- [Persona YAML schema](#persona-yaml-schema)
- [Hygiene](#hygiene)
- [Tests and automation](#tests-and-automation)
- [Docs parity](#docs-parity)

---

## Purpose by segment

| Segment | xAI collection suffix (after `atx-trusted-advisor-<dev|stage|prod>-`) | Role |
| --- | --- | --- |
| **`xpersonas/`** | `xpersonas` | xPersona seed specs — **exactly one `*.yaml` per subfolder** (Grok / Mongo `seed:xpersonas`; no `.md` in this segment). Ingested with **`npm run seed:admin`** — **`scripts/lib/seed-xai-rag-ingest.mjs`**; **`SKIP_SEED_XAI_RAG_INGEST`** opts out. |
| **`finance-reference-docs/`** | *(same folder name)* | Reference PDFs (disclosures, licensing). |
| **`example-prompts/`** | `example-prompts` | Example user prompts / scenario copy for UX and KB samples. |
| **`options-strategy/`** | `options-strategy` | Strategy Markdown (`xfinance-strategy-*` frontmatter) + hub index — see **[`options-strategy/README.md`](./options-strategy/README.md)**. |

Legacy repo folders **`personas-trusted-family`**, **`xchat-example-prompts`**, **`atx-personas-trusted-family`**, **`atx-xchat-example-prompts`**, **`atx-options-strategy`** are still **ingest path fallbacks** (see seed script).

---

## RAG path layout

**Rule (default):** For most segments, each ingestible file lives at **`…/<segment>/<stem>/<stem>.<ext>`** — **directory name equals filename stem** (e.g. `wheel/wheel.md`, `example-prompts/example-prompts/example-prompts.md`, `Fidelity-WiretoyourFidelity-account/Fidelity-WiretoyourFidelity-account.pdf`).

**xpersonas:** Subfolders are **short buckets** (e.g. `trusted/`, `legal/`, `super-agent/`). Each bucket holds **exactly one** persona **`stem/stem.yaml`** where **folder name equals file stem** (same convention as other RAG segments). This folder is **YAML-only** so Grok-facing persona specs stay consistent with `seed:xpersonas` and admin governance.

Segment-level **`README.md`** files are for humans; ingest skips lowercase `readme.md` by name.

**Why:** Upload logical names derive from relative paths; stable paths improve RAG tags and indexing.

---

## Segment file listing

### xpersonas

| Path | Notes |
| --- | --- |
| `trusted/atx-trusted-advisor.yaml` | Persona spec |
| `legal/legal-advisor.yaml` | Persona spec |
| `marriage-planner/marriage-planner-advisor.yaml` | Persona spec |
| `medical/medical-advisor.yaml` | Persona spec |
| `options-trader/options-trader-advisor.yaml` | Persona spec |
| `tax-expert/atx-tax-expert-advisor.yaml` | Persona spec |
| `exam-coach/exam-coach.yaml` | Persona spec |
| `super-agent/super-agent.yaml` | Persona spec (global-admin **Super-Agent**) |
| `finance-xoptions/finance-xoptions.yaml` | Persona spec |

### finance-reference-docs

| Path |
| --- |
| `Fidelity-WiretoyourFidelity-account/Fidelity-WiretoyourFidelity-account.pdf` |
| `MerrillEdge-Retail-Option-application/MerrillEdge-Retail-Option-application.pdf` |
| `MerrillEdge-Transfers-Withdrawals/MerrillEdge-Transfers-Withdrawals.pdf` |
| `options-risks-toc_supplement/options-risks-toc_supplement.pdf` |
| `Series 65-LEM-12E/Series 65-LEM-12E.pdf` |
| `Series7-LEM-3E-REV5-secured/Series7-LEM-3E-REV5-secured.pdf` |

### example-prompts

| Path |
| --- |
| `example-prompts/example-prompts/example-prompts.md` |

### options-strategy

| Path |
| --- |
| [`README.md`](./options-strategy/README.md) (docs only; not ingested as content) |
| [`options-coreskills/options-coreskills.md`](./options-strategy/options-coreskills/options-coreskills.md) |
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

---

## Persona YAML schema

These **YAML** specs are **xPersona / RAG seeds** only. They are **not** Cursor subagents (`.cursor/agents/*.md`). Field names (`id`, `description`, `INSTRUCTIONS`, …) are a separate contract from Subagent frontmatter.

| Key | Notes |
| --- | --- |
| Top comment | First line: `# atx-rag-collection/xpersonas/<bucket>/<file>.yaml` (exact repo path) |
| `id` / `name` | Stable persona slug for Mongo / product (may differ from folder name) |
| `description` | Block scalar; product-facing summary |
| `icon` / `color` | Optional on agents; **required** here for admin/UI parity |
| `INSTRUCTIONS` | Bullet list for operator / ingest hints |
| `setup` | Shell one-liner; `test -f` the **actual** yaml path under `xpersonas/` |
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
- **`seed:admin`:** Runs the same sync automatically after Mongo writes (unless **`SKIP_SEED_XPERSONAS`**), so **`/admin/personas`** lists YAML-backed personas without a second command.
- **Ordering:** xAI should already have the **`…-xpersonas`** collection (normal when **`seed:admin`** RAG ingest ran first in the same invocation). Standalone **`npm run seed:xpersonas`** after a manual collection create is still supported.
- **`SEED_XPERSONAS_MODE`:** **`merge`** (default) fills missing `xaiCollection.collectionId` and appends `xapi.tools` by `type` without overwriting prompts or existing tool payloads. **`replace`** overwrites prompts, scalars, and `xapi`; keeps `status` / `version` / `publishedAt`; sets `xaiCollection` only when a collection id resolves.
- **Flags:** **`SKIP_SEED_XPERSONAS`**, production **`replace`** + **`SEED_XPERSONAS_STRICT=1`** — see **`DEVELOPMENT.md`** (RAG / seed notes).

---

## Hygiene

- One canonical paragraph per idea — no duplicate blocks in a single file.
- Keep shared-repo copy **generic** (no real names, private budgets, or PII).
- Prefer PDF filenames **without spaces** when adding new docs (existing `Series 65-LEM-12E` path is grandfathered).

---

## Tests and automation

- **`seed:admin`** walks **`atx-rag-collection/`** when xAI keys are set; see **`scripts/lib/seed-xai-rag-ingest.mjs`**. Layout tests: **`tests/unit/atx-rag-collection-layout.test.ts`**.

---

## Docs parity

- **`generate-docs`** § *RAG collection sources* — update when folders or seed contract change.
- **Runtime model** for app personas follows **`XAI_CHAT_MODEL`** (default **`grok-4-1-fast-reasoning`** in **`.env.example`**).
- Engineering index: **`atx-docs/README.md`** (options narratives + links into this tree).
