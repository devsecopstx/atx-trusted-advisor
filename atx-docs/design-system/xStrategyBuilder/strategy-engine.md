# ATX Finance — OptionsStrategyEngine (high-level view)

![OptionsStrategyEngine — recommendation pipeline flow](./StrategyEngine.svg)

*Flowchart: scan request → user context → chains → filter strategies → per-ticker/strategy scoring → threshold branch → legs → risk/reward → rationale → collect → rank → top N.*

This flow is executed once per scheduled job (user-level or platform-wide). The scheduler simply calls the engine with the right prompt payload from the scheduled_tasks table.

**Source:** [`StrategyEngine.svg`](./StrategyEngine.svg) (same folder). If GitHub does not inline SVG in Markdown, use **Raw** / open that file in the repo tree — the diagram is committed as vector SVG.

**Fit score (canonical):** [weighted formula (math + table below)](#fit-score-formula) · [formula slide (PNG)](./strategy-engine-fit-score-formula.png)

---

The OptionsStrategyEngine is the intelligent brain of the scheduled `options_scanner` job. It is a lightweight, rule-based scoring component (Kotlin @Component) that turns raw options-chain data + rich user context into personalized, ranked, structured strategy recommendations. No heavy ML in v1 — just fast, explainable, finance-grade logic that you can extend or swap with an LLM later.

**Implementation (JVM):** `services/atxfinance-backend/.../strategy/OptionsStrategyEngine.kt` — `generateRecommendations`, weighted `calculateFitScore` (defaults match the table below), `scheduledTaskDryRunOutput` for Kotlin scheduled-task ticks. Full Yahoo chain + Mongo portfolio pass for app tenants remains in the Next.js task-runner (`src/modules/strategy-options/options-strategy-scanner-job.ts`) unless product moves execution to Spring-only.

### Product umbrella (PLAN 280)

Single narrative for **score/rank** work across surfaces:

- **Goals:** Classic structures with real-time chain data + portfolio constraints; bias toward **capital preservation**, **tax efficiency**, and **income over speculation** (copy-level; risk gates stay in engine + scanner rules).
- **Components:** Kotlin **`OptionsStrategyEngine`** (weighted fit, ranked `StrategyRecommendation`s, JVM scheduler hook) · Next.js **`executeOptionsStrategyScannerJob`** (Yahoo chain batches, **`options_strategy` `filters`**, desk rule/Grok **`rankedSignals`**, recommendations + alerts) · interactive **xOptions** / xStrategyBuilder for guided execution paths.
- **Docs:** Scheduled job — [`options-scanner.md`](../scheduled-task/options-scanner.md); this file remains the **fit-score** contract. **PLAN 270n** (prefs + ranked scanner output) and **245n** (Kotlin core) are shipped under this umbrella; deeper chain-expiry expansion and product UI remain backlog unless listed in [`PLAN.md`](../../PLAN.md).

**Terminology (product copy):** At the **account**, user-facing inputs are **risk** and **outlook** only — not “strategy factors.” **Portfolio scoring factors** (the weighted dimensions below, e.g. IV rank, liquidity) apply at the **portfolio book** for ranking recommendations; keep that naming distinct from account-level fields.

Function,Purpose,Key Inputs,Output
"generateRecommendations(context, chains, prompt)",Main orchestrator — runs the entire recommendation pipeline,"UserOptionsContext, Map<ticker, OptionChain>, OptionsScanPrompt",List<StrategyRecommendation> (ranked)
buildUserContext(userId),Loads & normalizes everything about the user,userId,"UserOptionsContext (portfolio, risk, outlook, watchlist, account type)"
filterEligibleStrategies(context),Quick pre-filter so we never waste cycles,user risk tolerance + market outlook,Subset of the 10 strategies
"calculateFitScore(strategy, tickerData, context, prompt)",Core weighted scoring engine,"IV rank, OI, volume, Greeks, portfolio delta match, liquidity",Integer score 0-100
"buildOptionLegs(strategy, chain)",Converts abstract strategy into concrete trades,Selected strategy + full chain,"List of OptionLeg (buy/sell, call/put, strike, expiry)"
calculateRiskRewardMetrics(legs),Computes real P&L numbers,Built legs,"Max profit, max loss, breakeven, POP %"
generateRationale(scoreBreakdown),Human-readable “why this recommendation” text,Score components,Plain-English string for UI/email.

## Major features

Fully personalized — respects the user’s actual portfolio holdings, risk tolerance, account type (cash vs margin), and market outlook (bullish/bearish/neutral).
Preference-driven — honors the scan “prompt” (IV rank ≥ X, high OI, min volume, favorite strategies, etc.).
Risk-aware & compliant — automatically drops strategies that exceed the user’s risk level or margin requirements.
Explainable — every recommendation includes a clear rationale + risk/reward numbers.
High performance — processes dozens of tickers in < 2 seconds (batch Yahoo/Polygon calls + simple math).
Extensible — add new option strategies or **portfolio** scoring-factor dimensions (e.g., earnings date filter, sector exposure) with zero code changes to the scheduler.
Dual-mode — works for both user-level jobs (personalized) and platform-level jobs (global “hot opportunities” list).

## Fit score formula

Expanded **`calculateFitScore`** inside OptionsStrategyEngine: a **weighted linear model (0–100)**, deterministic and explainable (no black-box ML in v1), finance-grade (IV, liquidity, Greeks, portfolio fit), overridable via **OptionsScanPrompt** weights, fast (≪1 ms per ticker/strategy in typical runs).

**Reference image (same equation):** [strategy-engine-fit-score-formula.png](./strategy-engine-fit-score-formula.png)

### Scoring factors & default weights

| Factor | Weight (default) | Description & normalization |
| --- | --- | --- |
| IV rank | 30% | Implied vol vs ~1y history → normalized 0–1 |
| Open interest | 20% | Chain OI (e.g. log-scaled + normalized) |
| Volume | 15% | Daily option volume, normalized |
| Liquidity | 10% | Bid–ask spread % (tighter = higher sub-score) |
| Portfolio fit | 15% | Delta / exposure match to holdings |
| Outlook & risk alignment | 10% | Book outlook + risk tolerance vs recommended structure |

### Formula (mathematical)

$$
\text{score} = 100 \times (0.30 \cdot S_{\text{IV}} + 0.20 \cdot S_{\text{OI}} + 0.15 \cdot S_{\text{Vol}} + 0.10 \cdot S_{\text{Liq}} + 0.15 \cdot S_{\text{Port}} + 0.10 \cdot S_{\text{Align}})
$$

where each $S_{\cdot}$ is a **normalized sub-score in [0.0, 1.0]**. Weights sum to **1.0**.

### Plain text (implementation)

`score = 100 * (0.30 * S_IV + 0.20 * S_OI + 0.15 * S_Vol + 0.10 * S_Liq + 0.15 * S_Port + 0.10 * S_Align)`

## Prompt overrides
Prompt overrides: User can send {"preferredMetrics": ["iv_rank", "oi"], "weights": {"iv_rank": 0.40}} — the getWeight() helper picks them up.
Add new factors (e.g., earnings date filter, sector exposure): just add another term and a new weight.
Threshold: In generateRecommendations we still do if (score > 70) — tunable per user risk profile.
Logging: Store the raw score breakdown in StrategyRecommendation.scoreBreakdown JSONB for UI tooltips.
