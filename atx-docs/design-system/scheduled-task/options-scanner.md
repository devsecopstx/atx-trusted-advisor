Option Scanner — Concise Requirements

Overview
The Option Scanner is a rule-based + Grok-enhanced job that scans all options positions (calls & puts) from the default portfolio account and watchlist symbols.
It evaluates every open option holding and potential opportunities on watchlist symbols using option-strategy-prefs, then generates actionable recommendations (primarily HOLD or BUY_TO_CLOSE) with confidence and rationale.
Job type: optionScanner (runs as part of unifiedOptionsScanner)
Scope

Sources:
Default portfolio account holdings (existing option positions)
Watchlist symbols (for new opportunities)

Focus: Calls and puts only
Filters: Applies option-strategy-prefs (IV, OI, volume, delta, etc.)

Core Flow

runOptionScanner(accountId?, config?)

     ↓
Load default portfolio (risk,outlook) + watchlist symbols
     ↓
For each option position / watchlist symbol:
   • Fetch real-time option chain + greeks via Yahoo
   • Apply filters (min OI, min volume, IV range, etc.)
   • Evaluate rules (DTE, P/L %, time value %, stop-loss, IV spike)
   • Edge cases → optional Grok analysis
     ↓
Store recommendation, rationale in optionRecommendations
Create alerts (BUY_TO_CLOSE only)
     ↓
Return stats: scanned, stored, alertsCreated

Key Evaluation Rules (configurable)

HOLD if DTE ≥ holdDteMin and time value % ≥ holdTimeValuePercentMin
BUY_TO_CLOSE if DTE < btcDteMax or P/L < btcStopLossPercent
High IV puts → conservative treatment
Grok candidates: high |P/L|%, low DTE, high IV

Configuration (from UnifiedOptionsScannerConfig)

optionScanner overrides: holdDteMin, btcDteMax, btcStopLossPercent, holdTimeValuePercentMin, highVolatilityPercent, grokEnabled, etc.
Strategy prefs: IV rank/percent, min OI, min volume, max delta, risk profile

Output
TypeScript{
  scanned: number,
  stored: number,
  alertsCreated: number
}