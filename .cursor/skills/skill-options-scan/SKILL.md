# Options Scan Report Generation Skill

**When to use:** Any task involving `options_scan`, `OptionsHoldingsAdvisor`, report generation, action rules (ROLL/BTC/HOLD/etc.), or scheduled report logic.

**Mandatory behavior:**

- **Always** prototype or validate complex report logic (rules engine, Greeks calculations, P/L thresholds, urgency scoring, table formatting) using the **code interpreter** first.
- Use the interpreter to:
  - Test deterministic rules with sample holdings data
  - Validate edge cases (DTE=0, deep ITM, watchlist-only entries)
  - Generate sample markdown tables
  - Check plan-gating truncation logic
- Only after the interpreter confirms correctness, write the production Kotlin/TS code.
- Never hard-code magic numbers without interpreter verification.

**Example interpreter usage (you must do this):**

- Feed it 5–10 realistic holdings + watchlist rows
- Ask it to compute recommended_action + why + urgency for each
- Ask it to output the exact markdown table shape we defined
- Ask it to simulate weekly vs monthly cadence behavior

**Output contract:**

- The final report must be deterministic + auditable (rules first, AI summary optional).
- Always include confidence + "Not financial advice" footer.

**References:**

- Backlog item 250 in PLAN.md
- `portfolio_positions` schema + `core_users.optionsScanPreferences`
- Existing `OptionsStrategyEngine` patterns
