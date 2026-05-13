import { describe, expect, it } from "vitest";

import { coerceOptionsActionScanRowsFromToolJson } from "@/modules/xchat/options-action-scan";

describe("coerceOptionsActionScanRowsFromToolJson", () => {
  it("passes through canonical Next rows unchanged (shape)", () => {
    const rows = coerceOptionsActionScanRowsFromToolJson([
      {
        rowId: "h:1",
        source: "holding",
        symbol: "AAPL",
        strike: 150,
        exp: "2026-06-20",
        type: "call",
        qty: 1,
        recommendedAction: "STC",
        why: "Test",
        urgency: "med",
        targetWindow: "weekly",
        confidence: "high",
        applyToWatchlist: {
          type: "apply_to_watchlist",
          symbol: "AAPL",
          allowPriceAlert: true,
          defaultPriceAlertSeverity: "info"
        }
      }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("holding");
    expect(rows[0]!.recommendedAction).toBe("STC");
  });

  it("coerces Spring stub rows (action + note, no source) into watchlist bucket", () => {
    const rows = coerceOptionsActionScanRowsFromToolJson([
      {
        symbol: "TSLA",
        action: "MONITOR",
        structure: "Review options chain",
        note: "Spring workspace scan from Mongo holdings + watchlist."
      }
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("watchlist");
    expect(rows[0]!.recommendedAction).toBe("MONITOR");
    expect(rows[0]!.why).toContain("Spring workspace scan");
    expect(rows[0]!.rowId.length).toBeGreaterThan(4);
    expect(rows[0]!.applyToWatchlist.symbol).toBe("TSLA");
  });
});
