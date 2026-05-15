# finance-core (RAG segment)

Cross-cutting **finance and options literacy** for the desk: primitives, risk education, tight references, and reusable glossary. **Not** single-strategy playbooks (`options-strategy-*`) and **not** voice/compliance copy (`atx-response-guidelines`).

| Doc | Role |
| --- | --- |
| [`primitives-and-mechanics.md`](./primitives-and-mechanics.md) | Orders, settlement, margin, positions, chains/quotes |
| [`risk-and-product-education.md`](./risk-and-product-education.md) | IV/OI, assignment/exercise, “what can go wrong” primers |
| [`short-desk-references.md`](./short-desk-references.md) | Pointers + small PDFs (e.g. options risks TOC supplement) |
| [`glossary-hnwi-desk-101.md`](./glossary-hnwi-desk-101.md) | Definitions and framing reused across strategies |

**Ingest:** This folder is **not** yet registered in `finance-kb-sync` `resolveFinanceKbRoots`; add it there (and optional persona `always_include`) before `refresh-finance` will upload these files. `README.md` is skipped by ingest (same rule as `readme.md`).
