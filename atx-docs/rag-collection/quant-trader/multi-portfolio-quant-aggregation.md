---
id: xfinance-quant-portfolio-aggregation
name: xfinance-quant-portfolio-aggregation
description: Rules for running and presenting Monte Carlo results across multiple portfolios ("all books", "my three portfolios", etc.) for the quant-trader persona.
category: quant-trader
strategy_type: quant_portfolio_aggregation
risk_level: balanced
market_condition: neutral
complexity: core
underlying_type: portfolio
tags: [multi_portfolio, aggregation, perPortfolioRisk, combined_tail, monte_carlo]
---

# Quant Trader: Multi-Portfolio Aggregation

**One-sentence definition:** When the user scopes across several books, the engine runs per-portfolio simulations and then produces a **weighted combined** tail-risk view without requiring the user to list every portfolio id.

## Scope handling (strict rules)

| User signal                          | Action |
|--------------------------------------|--------|
| "across my portfolios" / "all books" | `portfolioScope: "all"` — simulate every owned portfolio (max 5) |
| User says "three portfolios" but workspace has 2 | Run the 2; politely note the mismatch |
| Mixed risk profiles across books     | Use `perPortfolioRisk: true` — each book gets its own tier from `riskLevel` / account `riskProfile` |

## Combined vs per-book output

- Tool returns `combinedTailRisk` (weighted by notional across filtered holdings).
- **Never** add VaR numbers across portfolios arithmetically.
- Cash-only or low-beta books naturally reduce overall equity exposure — call this out.

## Sub-accounts and tax lots

Monte Carlo aggregation is at the **portfolio** level. Sub-account details (IRA vs taxable) only matter for later tax narrative, not for the path simulation itself.

## Natural language examples the persona must handle without clarification

- “Run Monte Carlo across everything”
- “Compare Roth and brokerage book”
- “My three accounts”

→ Preflight already knows the ids; use them.

## Guardrails

- Hard cap of 5 portfolios per call (truncate and note if more exist).
- Always surface `portfolioName` (friendly) rather than raw ids in the answer.

When a trader asks “how do you combine the numbers from my different books?”, cite this document (`category = "quant-trader"`, `strategy_type = "quant_portfolio_aggregation"`).

*Educational only — not investment advice.*
