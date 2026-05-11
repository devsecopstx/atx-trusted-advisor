# atx-rag-collection

Canonical documentation for this tree lives in
[`rag-collection.md`](./rag-collection.md).

Use that file for RAG source layout, ingest rules, and seed behavior.

**Canonical Finance KB:** all tenants inherit one shared xAI **Finance** collection (`XAI_FINANCE_COLLECTION_ID`). Refresh from repo markdown with **`npm run seed:finance-xai-collection`** or **`POST /api/admin/rag/refresh-finance`** (global admin).
