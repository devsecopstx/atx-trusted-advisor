# atx-rag-collection

Canonical documentation for this tree lives in
[`rag-collection.md`](./rag-collection.md).

Use that file for RAG source layout, ingest rules, and seed behavior.

**Canonical Finance KB:** all tenants inherit one shared xAI **Finance** collection (`XAI_FINANCE_COLLECTION_ID`). Refresh uploads **`options-strategy-core`**, **`options-strategy-advanced`**, **`atx-response-guidelines`**, and **`finance-core`** (when those dirs exist) from repo markdown with **`npm run seed:finance-xai-collection`** or **`POST /api/admin/rag/refresh-finance`** (global admin). **`xpersonas/*.yaml`** **`always_include`:** **`finance-core/**`**, **`atx-response-guidelines/**`**, and **`finance-advisor`** → **`options-strategy-core/**`** only; **`advisor`** → **`options-strategy-advanced/**`** only — see **[`../README.md`](../README.md)** § Options.

**PDF ingest (desk reports → markdown):**

- **CLI:** `npm run ingest:pdf -- --file=/path/report.pdf --slug=advanced-iron-condor-2026 --title="…" --risk=Balanced --outlook="Bullish Vol" --tags=iron-condor,adjustment`
- **Output:** `atx-docs/rag-collection/<slug>/` — `ingest.manifest.json`, chunked `*.md` with YAML frontmatter (same keys as **`options-strategy-core/options-coreskills.md`**), optional `source.pdf` copy.
- **Python:** `services/pdf-ingest/ingest_pdf.py` via **pymupdf4llm** (`pip install -r services/pdf-ingest/requirements.txt`).
- **Admin:** **`/admin/rag-ingest`** — upload, preview first chunk, metadata edit, download markdown, one-click **Mongo** (`options_strategy`) + **xAI** Finance KB seed.
- **Sync:** Ingested chunks are included in **`npm run seed:finance-xai-collection`** / **`POST /api/admin/rag/refresh-finance`** (segment from manifest, default **`options-strategy-advanced`**).

**Cross-refs (ops, not ingest):** xChat daily/hour prompt caps and **`XchatUsageMeter`** → **`atx-docs/sre-ops/tenant-workspace-limits.md`**, **`atx-docs/guides/api-endpoints.md`** § xChat, **`atx-docs/xchat-harden.md`**. Persona disk paths here are unrelated to **`xchat_usage_limits`** bucket keys.
