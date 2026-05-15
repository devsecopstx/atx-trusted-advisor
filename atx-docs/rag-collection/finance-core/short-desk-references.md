# atx-rag-collection/finance-core/short-desk-references.md

---
id: xfinance-finance-core-desk-refs
name: finance-core-short-desk-references
description: Pointers to tight explainers and companion PDFs for options risk and desk literacy
complexity: core
underlying_type: stock
tags: [finance_core, desk_reference, pdf, risk_disclosure]
---

# Short desk references

Use this segment for **short markdown** that points to **small PDFs** or external canonical docs—keep prose here minimal; depth stays in linked files or strategy segments.

## In-repo PDF (example)

- **`options-risks-toc_supplement/options-risks-toc_supplement.pdf`** — table-of-contents style supplement for options risks; use when the user needs a **scannable outline** of risk topics, not a full treatise. Prefer summarizing 3–5 bullets from retrieved context rather than dumping the PDF.

## When to cite vs summarize

- **Cite** when quoting a numbered disclosure or a defined term from a broker PDF.
- **Summarize** when the user needs action-oriented desk guidance; link or name the source in one line.

## What belongs here vs elsewhere

- **Here** — TOC supplements, one-pagers, checklists, “open these sections when…” maps.
- **Large custodian PDFs** — when you ingest them, use **`finance-core/<stem>/<stem>.pdf`** (directory name equals filename stem) so upload paths and metadata stay aligned; keep very large packs external unless policy requires local ingest.
- **`options-strategy-*`** — payoff and trade-structure narratives.

## Upload hygiene

- Keep PDFs **small** (team policy: cap size per file unless justified for compliance).
- Prefer **searchable** PDFs; scanned pages reduce RAG quality unless OCR’d upstream.
