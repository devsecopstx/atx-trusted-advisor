# atx-rag-collection

**Repository source content** for **in-app RAG and xPersona / xChat knowledge** — not Cursor agent definitions (those live only under **`.cursor/agents/*.yaml`**).

## Purpose

- **`atx-personas-trusted-family/`** — Persona-oriented markdown (and any app-specific YAML) intended for **xAI collection upload** and/or **Mongo `xpersonas` seed/update** during **`npm run seed:admin`** or a follow-on script. *Ingest is **not** wired in `scripts/seed-admin-user.mjs` yet — see **`atx-docs/PLAN.md`** § *Admin seed — RAG collection sync*.*
- **`finance-reference-docs/`** — Reference PDFs (disclosures, licensing supplements) for the same pipeline.
- **`atx-xchat-example-prompts/`** — Example user prompts / scenario copy for docs, chips, or KB samples.

## Layout (current)

| Path | Convention |
| --- | --- |
| `atx-personas-trusted-family/` | Prefer **`kebab-case.md`** (or `atx-*.md`) for RAG **body text**. Persona **seed specs** use **`atx-*.yaml`** with the same key shape as **`.cursor/agents/*.yaml`** (see **Persona YAML schema** below). |
| `finance-reference-docs/` | PDFs; prefer **no spaces** in filenames. |
| `atx-xchat-example-prompts/` | Markdown examples for UX / training. |

## Persona YAML schema (`atx-personas-trusted-family/*.yaml`)

Aligned with **`.cursor/agents/*.yaml`** for tooling parity. These files are **not** Cursor agents; they are **xPersona / RAG seed** specs.

| Key | Notes |
| --- | --- |
| Top comment | First line: `# atx-rag-collection/atx-personas-trusted-family/<stem>.yaml` |
| `id` / `name` | Match filename stem (e.g. `atx-legal-advisor`) |
| `description` | Block scalar; product-facing summary |
| `icon` / `color` | Optional on agents; **required** here for admin/UI parity |
| `INSTRUCTIONS` | Bullet list for operator / ingest hints |
| `setup` | Shell one-liner; typically `test -f atx-rag-collection/.../<stem>.yaml` |
| `model` | Default chat model id (e.g. `grok-4-1-fast-reasoning`); app may override via env |
| `system_prompt` | Block scalar; runtime persona body |
| `always_include` | Repo paths under `atx-rag-collection/` (or other in-repo globs), not `.cursor/` |
| `never_include` | Standard excludes: `node_modules/`, `.next/`, `dist/`, `"**/*.log"` |
| `commands` | Short echo hints for UX / docs (optional extensions per persona) |

Cursor agents may include **`worktree:`**; persona specs omit it.

## Hygiene

- One canonical paragraph per idea — no duplicate blocks in a single file.
- Keep shared-repo copy **generic** (no real names, private budgets, or PII).

## Tests & automation

- **`seed:admin` today** does **not** walk this tree. When ingest ships, add tests for discovery, hashing, idempotency, and optional `--dry-run`; update **`DEVELOPMENT.md`** and run **`npm run ci:gate`**. A layout smoke test lives in **`tests/unit/atx-rag-collection-layout.test.ts`**.

## Docs parity

- **`generate-docs`** § *RAG collection sources* — update when folders or seed contract change.
- **Runtime model** for app personas follows **`XAI_CHAT_MODEL`** (default **`grok-4-1-fast-reasoning`** in **`.env.example`**).
