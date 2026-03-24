# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor agent definitions (those live only under **`.cursor/agents/*.yaml`**).

## Purpose

- **`atx-personas-trusted-family/`** — Persona-oriented markdown (and any app-specific YAML) intended for **xAI collection upload** and/or **Mongo `xpersonas` seed/update** during **`npm run seed:admin`** or a follow-on script. *Ingest is **not** wired in `scripts/seed-admin-user.mjs` yet — see **`atx-docs/PLAN.md`** § *Admin seed — RAG collection sync*.*
- **`finance-reference-docs/`** — Reference PDFs (disclosures, licensing supplements) for the same pipeline.
- **`atx-xchat-example-prompts/`** — Example user prompts / scenario copy for docs, chips, or KB samples.

## Layout (current)

| Path | Convention |
| --- | --- |
| `atx-personas-trusted-family/` | Prefer **`kebab-case.md`** (or `atx-*.md`) for RAG **body text**. Avoid pasting full **Cursor agent YAML** here unless it is explicitly part of the product ingest contract. |
| `finance-reference-docs/` | PDFs; prefer **no spaces** in filenames. |
| `atx-xchat-example-prompts/` | Markdown examples for UX / training. |

## Hygiene

- One canonical paragraph per idea — no duplicate blocks in a single file.
- Keep shared-repo copy **generic** (no real names, private budgets, or PII).

## Tests & automation

- **`seed:admin` today** does **not** walk this tree. When ingest ships, add tests for discovery, hashing, idempotency, and optional `--dry-run`; update **`DEVELOPMENT.md`** and run **`npm run ci:gate`**. A layout smoke test lives in **`tests/unit/atx-rag-collection-layout.test.ts`**.

## Docs parity

- **`generate-docs`** § *RAG collection sources* — update when folders or seed contract change.
- **Runtime model** for app personas follows **`XAI_CHAT_MODEL`** (default **`grok-4-1-fast-reasoning`** in **`.env.example`**).
