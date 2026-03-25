# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor agent definitions (those live only under **`.cursor/agents/*.yaml`**).

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
| **`xpersonas/`** | `xpersonas` | xPersona seed **`*.yaml`** (per subfolder) plus RAG markdown (**`exam-coach`**, **`super-agent`**, **`finance-xoptions`**, etc.). Ingested with **`npm run seed:admin`** — **`scripts/lib/seed-xai-rag-ingest.mjs`**; **`SKIP_SEED_XAI_RAG_INGEST`** opts out. |
| **`finance-reference-docs/`** | *(same folder name)* | Reference PDFs (disclosures, licensing). |
| **`example-prompts/`** | `example-prompts` | Example user prompts / scenario copy for UX and KB samples. |
| **`options-strategy/`** | `options-strategy` | Strategy Markdown (`xfinance-strategy-*` frontmatter) + hub index — see **[`options-strategy/README.md`](./options-strategy/README.md)**. |

Legacy repo folders **`personas-trusted-family`**, **`xchat-example-prompts`**, **`atx-personas-trusted-family`**, **`atx-xchat-example-prompts`**, **`atx-options-strategy`** are still **ingest path fallbacks** (see seed script).

---

## RAG path layout

**Rule (default):** For most segments, each ingestible file lives at **`…/<segment>/<stem>/<stem>.<ext>`** — **directory name equals filename stem** (e.g. `wheel/wheel.md`, `example-prompts/example-prompts.md`, `Fidelity-WiretoyourFidelity-account/Fidelity-WiretoyourFidelity-account.pdf`).

**xpersonas exception:** Subfolders are **short buckets** (e.g. `trusted/`, `legal/`). Each bucket holds **one** persona **`*.yaml`** (filename may differ from folder name; first-line comment + `setup:` must match the real path) **or** a **stem/stem.md** narrative (`exam-coach/exam-coach.md`, `super-agent/super-agent.md`, `finance-xoptions/finance-xoptions.md`).

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
| `exam-coach/exam-coach.md` | RAG body |
| `super-agent/super-agent.md` | RAG body |
| `finance-xoptions/finance-xoptions.md` | RAG body |

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
| `example-prompts/example-prompts.md` |

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

Aligned with **`.cursor/agents/*.yaml`** for tooling parity. These files are **not** Cursor agents; they are **xPersona / RAG seed** specs.

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
| `always_include` | Repo paths under `atx-rag-collection/` (or other in-repo globs), not `.cursor/` |
| `never_include` | Standard excludes: `node_modules/`, `.next/`, `dist/`, `"**/*.log"` |
| `commands` | Short echo hints for UX / docs (optional extensions per persona) |

Cursor agents may include **`worktree:`**; persona specs omit it.

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
