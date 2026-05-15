# atx-rag-collection

Canonical documentation for this tree lives in
[`rag-collection.md`](./rag-collection.md).

Use that file for RAG source layout, ingest rules, and seed behavior.

**Canonical Finance KB:** all tenants inherit one shared xAI **Finance** collection (`XAI_FINANCE_COLLECTION_ID`). Refresh uploads **`options-strategy-core`**, **`options-strategy-advanced`**, **`atx-response-guidelines`**, and **`finance-core`** (when those dirs exist) from repo markdown with **`npm run seed:finance-xai-collection`** or **`POST /api/admin/rag/refresh-finance`** (global admin). **`xpersonas/*.yaml`** **`always_include`:** **`finance-core/**`**, **`atx-response-guidelines/**`**, and **`finance-advisor`** → **`options-strategy-core/**`** only; **`advisor`** → **`options-strategy-advanced/**`** only — see **[`../README.md`](../README.md)** § Options.
