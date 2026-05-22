# quant-trader (RAG segment)

Dedicated **calculation methodology and quant desk transparency** content for the `quant-trader` xChat persona and the Quant Trader surface in xOptions.

Focus: exact parameters, assumptions, path engine, filters, aggregation rules, stress scenarios, and risk-tier mapping used by the Monte Carlo tail-risk engine (`monte_carlo_tail_risk`), IV rank gates, drawdown targeting, and multi-portfolio synthesis.

**Goal:** When a trader asks "how did you calculate the 95% 1D VaR / CVaR / P(drawdown > 20%)?" or "explain the Student-t + jumps model", the model retrieves precise, citable methodology from this collection and grounds every number and assumption.

**Not** general options strategy narratives (those live in `options-strategy-core` / `options-strategy-advanced`) and **not** broad finance literacy (`finance-core`).

## Core Documents

| Doc | Role |
| --- | --- |
| [`monte-carlo-engine.md`](./monte-carlo-engine.md) | Full path engine spec (Student-t ν=6, base ρ=0.35 / crush 0.85, Poisson jumps λ=1.5, 10k paths, vol stress, correlation stress, IV sourcing from Yahoo) aligned with both TS simulator and JVM `MonteCarloTailRiskEngine` |
| [`iv-rank-strategy-selection-and-filtering.md`](./iv-rank-strategy-selection-and-filtering.md) | How IV rank floors are applied pre-simulation, per-symbol vs book-level, data source, edge cases |
| [`drawdown-and-risk-metric-playbook.md`](./drawdown-and-risk-metric-playbook.md) | Drawdown gate logic, P(DD > threshold), per-path vs terminal, interaction with VaR/CVaR |
| [`multi-portfolio-quant-aggregation.md`](./multi-portfolio-quant-aggregation.md) | Weighted vs per-book runs, `portfolioScope: all`, `perPortfolioRisk: true`, combined tail metrics |
| [`conservative-balanced-aggressive-quant-parameters.md`](./conservative-balanced-aggressive-quant-parameters.md) | Risk-tier CVaR caps, horizon defaults, IV rank floors, drawdown tolerances, and mapping from watchlist riskProfile / desk profile |

## Ingest & Metadata

- `category: "quant-trader"` (primary filter for the quant-trader persona and pre-RAG or file_search)
- `strategy_type`: `quant_monte_carlo`, `quant_iv_rank`, `quant_drawdown`, `quant_multi_portfolio`, `quant_risk_tier`
- `complexity`: `core` (engine details) or `advanced` (stress studies, convergence)
- `tags`: `monte_carlo`, `var`, `cvar`, `student_t`, `jumps`, `iv_rank`, `drawdown_gate`, `multi_portfolio`, `stress_2020`, `correlation_crush`

**Ingest path:** Added to `resolveFinanceKbRoots` (or dedicated quant root walker) in `finance-kb-sync.ts`. Uploaded via `npm run seed:finance-xai-collection` / Admin RAG refresh into the shared Finance xAI collection (or a dedicated team quant collection when `XAI_FINANCE_COLLECTION_ID` targets one). The persona `always_include` drives what must be present for reliable retrieval.

**Persona contract:** The `quant-trader` persona (model `grok-4.20-multi-agent`, heavy reasoning) declares these paths so that `file_search` / collections_search reliably returns methodology when the user asks for calculation transparency after seeing tail-risk numbers.

## Guardrails for new content

- Every methodology doc must state the exact constants used in the current engine (and note any divergence with the JVM production engine).
- Cite the tool (`monte_carlo_tail_risk`, `strategy_recommendations`) and preflight sources.
- Include "Educational only — not investment advice" and the standard compliance language.
- When parameters change in `monte-carlo-tail-risk.ts` or the backend engine, the corresponding RAG doc must be updated in the same PR.

**Migration note (2026-05):** Previous quant desk playbooks lived inside `options-strategy/<slug>/` and were selectively pulled by `resolveQuantDeskKbFiles`. New canonical home is this `quant-trader/` tree with explicit `category: "quant-trader"`. Old nested copies can be deprecated once the new collection is seeded and the persona updated.
