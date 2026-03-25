# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor agent definitions (those live only under **`.cursor/agents/*.yaml`**).

## Table of contents

- [Purpose by segment](#purpose-by-segment)
- [RAG layout standard (folder = file stem)](#rag-layout-standard-folder--file-stem)
- [Segment TOC (paths)](#segment-toc-paths)
- [Persona YAML schema](#persona-yaml-schema)
- [Hygiene](#hygiene)
- [Tests & automation](#tests--automation)
- [Docs parity](#docs-parity)

---

## Purpose by segment

| Segment | xAI collection suffix (after `atx-trusted-advisor-<dev|stage|prod>-`) | Role |
| --- | --- | --- |
| **`personas-trusted-family/`** | `personas-trusted-family` | xPersona seed specs (`*.yaml`) + optional body markdown. Ingested with **`npm run seed:admin`** when xAI keys resolve — **`scripts/lib/seed-xai-rag-ingest.mjs`**; **`SKIP_SEED_XAI_RAG_INGEST`** opts out. Mongo `xchat_personas` upsert from YAML is tracked in **`atx-docs/PLAN.md`**. |
| **`finance-reference-docs/`** | *(same folder name)* | Reference PDFs (disclosures, licensing). |
| **`xchat-example-prompts/`** | `xchat-example-prompts` | Example user prompts / scenario copy for UX and KB samples. |
| **`options-strategy/`** | `options-strategy` | Strategy Markdown (`xfinance-strategy-*` frontmatter) + hub index — see **[`options-strategy/README.md`](./options-strategy/README.md)**. |

Legacy folder names **`atx-personas-trusted-family`**, **`atx-xchat-example-prompts`**, **`atx-options-strategy`** are still accepted as **ingest path fallbacks** only (see seed script).

---

## RAG layout standard (folder = file stem)

**Rule:** Every file that should carry a **stable RAG path tag** must live at:

`…/<segment>/<stem>/<stem>.<ext>`

— i.e. **directory name equals filename stem** (e.g. `wheel/wheel.md`, `atx-example-prompts/atx-example-prompts.md`, `Fidelity-WiretoyourFidelity-account/Fidelity-WiretoyourFidelity-account.pdf`). Segment-level **`README.md`** files are for humans; ingest skips lowercase `readme.md` by name.

**Why:** Upload logical names derive from relative paths; matching folder and file stem avoids ambiguous tags and keeps indexes aligned with tooling.

---

## Segment TOC (paths)

### `personas-trusted-family/`

| Path |
| --- |
| `atx-legal-advisor/atx-legal-advisor.yaml` |
| `atx-marriage-planner-advisor/atx-marriage-planner-advisor.yaml` |
| `atx-medical-advisor/atx-medical-advisor.yaml` |
| `atx-options-trader-advisor/atx-options-trader-advisor.yaml` |
| `atx-tax-expert-advisor/atx-tax-expert-advisor.yaml` |
| `atx-trusted-advisor/atx-trusted-advisor.yaml` |

### `finance-reference-docs/`

| Path |
| --- |
| `Fidelity-WiretoyourFidelity-account/Fidelity-WiretoyourFidelity-account.pdf` |
| `MerrillEdge-Retail-Option-application/MerrillEdge-Retail-Option-application.pdf` |
| `MerrillEdge-Transfers-Withdrawals/MerrillEdge-Transfers-Withdrawals.pdf` |
| `options-risks-toc_supplement/options-risks-toc_supplement.pdf` |
| `Series 65-LEM-12E/Series 65-LEM-12E.pdf` |
| `Series7-LEM-3E-REV5-secured/Series7-LEM-3E-REV5-secured.pdf` |

### `xchat-example-prompts/`

| Path |
| --- |
| `atx-example-prompts/atx-example-prompts.md` |

### `options-strategy/`

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
| Top comment | First line: `# atx-rag-collection/personas-trusted-family/<stem>/<stem>.yaml` |
| `id` / `name` | Match filename stem exactly (e.g. `atx-legal-advisor`, `atx-options-trader-advisor`) |
| `description` | Block scalar; product-facing summary |
| `icon` / `color` | Optional on agents; **required** here for admin/UI parity |
| `INSTRUCTIONS` | Bullet list for operator / ingest hints |
| `setup` | Shell one-liner; `test -f atx-rag-collection/personas-trusted-family/<stem>/<stem>.yaml` |
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

## Tests & automation

- **`seed:admin`** walks **`atx-rag-collection/`** when xAI keys are set; see **`scripts/lib/seed-xai-rag-ingest.mjs`**. Layout tests: **`tests/unit/atx-rag-collection-layout.test.ts`**.

---

## Docs parity

- **`generate-docs`** § *RAG collection sources* — update when folders or seed contract change.
- **Runtime model** for app personas follows **`XAI_CHAT_MODEL`** (default **`grok-4-1-fast-reasoning`** in **`.env.example`**).
- Engineering index: **`atx-docs/README.md`** (options narratives + links into this tree).
