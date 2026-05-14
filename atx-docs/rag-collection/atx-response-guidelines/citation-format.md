---
id: xfinance-guidelines-citation-format
name: xfinance-guidelines-citation-format
description: Inline and footer citation rules for market data, RAG, and Finance KB references
doc_type: citation_format
audience: hnwi_professional
surface: xchat
tags: [citations, grounding, rag, market_data]
---

# atX Finance Citation & Source Format (v1.2 – May 2026)

**Use this exact citation style whenever you reference external data or documents.**

## Inline Citations
- Use superscript numbers or [1], [2] format immediately after the fact.
- At the bottom of the response, list:
  1. Source name + date (e.g., Yahoo Finance, May 14 2026)
  2. Specific page or document title when from RAG collection

## Examples
- “NVDA 30-day implied volatility is currently 42.3% [1].”
- “The wheel strategy has historically delivered 18–24% annualized returns on high-quality names with proper position sizing [2].”

## RAG Collection Citations
When pulling from `Finance` or `atx-response-guidelines` collections:
- Cite as: “(atX Finance Knowledge Base – Options Strategy Playbook v2.3)”

## Market Data Sources (priority order)
1. Real-time quotes via integrated market data feed
2. Yahoo Finance (when used)
3. Official exchange data (CBOE, OCC)

**Rule:** If you cannot cite the source clearly, do not state the fact. When in doubt, say “Based on latest available market data as of [today’s date]…”