import { describe, expect, it } from "vitest";

import { buildXoptionsRiskAlerts } from "@/modules/xoptions/risk-alert-service";

describe("buildXoptionsRiskAlerts", () => {
  it("flags short DTE and elevated assignment risk for short premium", () => {
    const alerts = buildXoptionsRiskAlerts({
      symbol: "TSLA",
      side: "put",
      openingAction: "sell_to_open",
      expirationYyyyMmDd: "2026-05-15",
      impliedVolatilityPercent: 80,
      probabilityOtmPercent: 55,
      earningsDateIso: null
    });
    expect(alerts.some((alert) => alert.id === "dte_short" || alert.id === "dte_medium")).toBe(true);
    expect(alerts.some((alert) => alert.id.startsWith("assignment_"))).toBe(true);
    expect(alerts.some((alert) => alert.id === "iv_rank_high")).toBe(true);
  });

  it("flags earnings before expiration", () => {
    const earnings = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
    const alerts = buildXoptionsRiskAlerts({
      symbol: "TSLA",
      side: "call",
      openingAction: "sell_to_open",
      expirationYyyyMmDd: "2026-12-19",
      impliedVolatilityPercent: 40,
      probabilityOtmPercent: 70,
      earningsDateIso: earnings
    });
    expect(alerts.some((alert) => alert.id === "earnings_before_expiry")).toBe(true);
  });
});
