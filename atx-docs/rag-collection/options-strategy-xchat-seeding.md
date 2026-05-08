# Options strategy & skills — xAI collection seeding (cost-aware)

Goal: **shift repetitive reasoning** (structures, Greek intuition, roll discipline, scan interpretation) from live model invention into **retrieved chunks** so `POST /api/xchat/ask` stays **RAG-first, tool-second** per [`context-routing-multi-agent-policy.md`](../xchat/context-routing-multi-agent-policy.md).

## What to upload

1. **Short narratives** (300–900 words each): covered calls, CSPs, spreads, condors, rolls, earnings risk — each as its own markdown/plain file in the tenant team collection linked from the persona (`file_search` / `collections_search`).
2. **Desk playbooks**: how your tenant phrases risk caps, DTE bands, liquidity floors — static prose, not live quotes.
3. **Cross-links**: one paragraph per doc that says “for **live** spot/Greeks use tools — never invent prices from this doc.”

## Ops checklist

- Upload via Admin RAG flows or xAI console under the same **`XAI_TEAM_ID`** collection ids already on the persona.
- Wait for indexing ready before relying on retrieval in prod.
- After bulk upload, spot-check `POST /api/xchat/ask` with a question answerable from docs alone — expect **fewer** `atx_function` / `yahoo_finance` calls when history + RAG suffice.

## Relationship to Mongo `xchat_rag_chunks`

Mongo lexical RAG (if enabled for a surface) complements team collections — prefer **one** canonical source per topic to avoid redundant chunks and drift.
