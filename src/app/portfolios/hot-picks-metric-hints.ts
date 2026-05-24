/** Copy for Hot Picks card metric column headers (info tooltips). */
export const HOT_PICKS_METRIC_HINTS = {
  entry:
    "Estimated entry for the primary option leg (mid or model fill at scan time). Not a live quote or execution price.",
  breakeven:
    "Underlying price where the structure is approximately P&L-neutral at expiration, per the strategy engine.",
  pop: "Probability of profit — approximate chance the trade finishes profitable before or at expiry (model-based, not a guarantee).",
  estRoi:
    "Estimated return on capital at risk if the position reaches its modeled max profit. Actual results vary with fills and path.",
  ivRank:
    "Implied volatility rank for the selected expiry versus recent history (0–100). Higher can favor premium-selling structures.",
  edgeScore:
    "Edge score (0–100) is the engine’s strategy fit grade: IV rank, liquidity, open interest, volume, portfolio alignment, and outlook match. Higher = stronger setup for your selected bias—not a guarantee of profit."
} as const;
