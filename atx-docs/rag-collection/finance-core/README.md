# finance-core (RAG segment)

Cross-cutting **finance and options literacy** for the desk: primitives, risk education, tight references, reusable glossary, and **HNWI desk series** in optional subfolders. **Not** single-strategy playbooks (`options-strategy-*`) and **not** voice/compliance copy (`atx-response-guidelines`).

| Doc | Role |
| --- | --- |
| [`primitives-and-mechanics.md`](./primitives-and-mechanics.md) | Orders, settlement, margin, positions, chains/quotes |
| [`risk-and-product-education.md`](./risk-and-product-education.md) | IV/OI, assignment/exercise, “what can go wrong” primers |
| [`short-desk-references.md`](./short-desk-references.md) | Pointers + small PDFs (e.g. options risks TOC supplement) |
| [`glossary-hnwi-desk-101.md`](./glossary-hnwi-desk-101.md) | Definitions and framing reused across strategies |

### HNWI desk series (nested markdown)

| Folder | Topics |
| --- | --- |
| [`portfolio-construction/`](./portfolio-construction/modern-portfolio-theory-hnwi.md) | MPT refresher, multi-book taxable/retirement/legacy, concentration thresholds |
| [`risk-management/`](./risk-management/position-sizing-drawdown-liquidity.md) | Posture-based sizing bands, drawdown / vol targeting, liquidity & cash-flow matching |
| [`asset-allocation/`](./asset-allocation/regime-factor-tilts.md) | Regime framing, factor tilts vs conservative/balanced/aggressive |
| [`tax-strategies/`](./tax-strategies/tlh-oz-1031-crt-wash-sales.md) | TLH vs lots (when modeled), OZ / 1031 / CRT themes, wash-sale + options |
| [`macro-outlooks/`](./macro-outlooks/yahoo-xai-indicator-playbooks.md) | Yahoo-backed indicators + recession / inflation / rate playbooks |
| [`behavioral-finance/`](./behavioral-finance/hnwi-biases-multi-agent.md) | HNWI biases and structured multi-step xChat discipline |
| [`legacy-estate/`](./legacy-estate/grats-ilit-dynasty-portfolio-integration.md) | GRAT / ILIT / dynasty trust **integration** framing (not legal advice) |
| [`rebalancing-mechanics/`](./rebalancing-mechanics/calendar-threshold-opportunistic.md) | Calendar vs threshold vs opportunistic rules + scanner alignment |
| [`performance-reporting/`](./performance-reporting/twr-mwr-irr-benchmarks.md) | TWR vs MWR / IRR, benchmark selection |
| [`custom-db-integrations/`](./custom-db-integrations/xchat-tenant-portfolio-grounding.md) | Meta: `tenant_portfolio`, `portfolio_accounts`, `portfolio_positions`, `atx_function` |

**Ingest:** `resolveFinanceKbRoots` in `finance-kb-sync` walks this tree recursively; `npm run seed:finance-xai-collection` / `POST /api/admin/rag/refresh-finance` uploads into the shared Finance xAI collection with `category = "finance-core"`. Ingest skips lowercase `readme.md` by filename; keep substantive content in topic `.md` files so the Finance KB stays high-signal.
