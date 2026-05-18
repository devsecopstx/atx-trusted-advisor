import { describe, expect, it } from "vitest";

import {
    buildHnwiExecutiveAdvisorNote,
    buildHnwiOrderSummaryHeadline,
    buildHnwiOrderSummaryMetaLine,
    buildHnwiOutlookRiskTag
} from "@/lib/xoptions/xoptions-hnwi-review-copy";
import { buildXoptionsOrderReview } from "@/lib/xoptions/xoptions-order-preview";

function baseReview() {
  return buildXoptionsOrderReview({
    symbol: "RDW",
    expirationYyyyMmDd: "2026-05-29",
    side: "put",
    openingAction: "sell_to_open",
    strike: 14.08,
    limitPrice: "1.15",
    quantity: "28",
    spot: 16.5,
    impliedVolatilityPercent: 72,
    strategyLabel: "Cash-secured put",
    legDelta: -0.32
  });
}

describe("xoptions-hnwi-review-copy", () => {
  it("builds order summary headline for CSP sell-to-open", () => {
    const orderReview = baseReview();
    const headline = buildHnwiOrderSummaryHeadline({
      symbol: "RDW",
      side: "put",
      openingAction: "sell_to_open",
      strike: 14.08,
      expirationYyyyMmDd: "2026-05-29",
      quantity: 28,
      limitPricePerShare: 1.15,
      orderReview,
      strategyLabel: "Cash-secured put",
      outlookSlug: "bullish",
      riskProfileSlug: "growth",
      portfolioName: "Family Office Book",
      cashBalanceUsd: 120_000,
      securedNotionalUsd: 39_424,
      impliedVolatilityElevated: true
    });
    expect(headline).toContain("Sell to Open 28 contracts");
    expect(headline).toContain("RDW");
    expect(headline).toContain("$1.15 per share");
    expect(headline).toContain("Estimated premium credit");
  });

  it("builds meta line with strategy, DTE, and outlook tag", () => {
    const meta = buildHnwiOrderSummaryMetaLine({
      symbol: "RDW",
      side: "put",
      openingAction: "sell_to_open",
      strike: 14.08,
      expirationYyyyMmDd: "2026-05-29",
      quantity: 28,
      limitPricePerShare: 1.15,
      orderReview: baseReview(),
      strategyLabel: "Cash-secured put",
      outlookSlug: "bullish",
      riskProfileSlug: "growth",
      portfolioName: null,
      cashBalanceUsd: null,
      securedNotionalUsd: 28_000,
      impliedVolatilityElevated: false
    });
    expect(meta).toContain("Cash-secured put");
    expect(meta).toContain("day");
    expect(buildHnwiOutlookRiskTag("bullish", "growth")).toContain("Bullish");
    expect(buildHnwiOutlookRiskTag("bullish", "growth")).toContain("Aggressive");
    expect(meta).toContain("outlook");
  });

  it("builds executive advisor note with collateral and cash pct", () => {
    const note = buildHnwiExecutiveAdvisorNote({
      symbol: "RDW",
      side: "put",
      openingAction: "sell_to_open",
      strike: 14.08,
      expirationYyyyMmDd: "2026-05-29",
      quantity: 28,
      limitPricePerShare: 1.15,
      orderReview: baseReview(),
      strategyLabel: "Cash-secured put",
      outlookSlug: "bullish",
      riskProfileSlug: "growth",
      portfolioName: "Family Office Book",
      cashBalanceUsd: 100_000,
      securedNotionalUsd: 28_000,
      impliedVolatilityElevated: true
    });
    expect(note.toLowerCase()).toContain("cash-secured put");
    expect(note).toContain("RDW");
    expect(note).toMatch(/28%|approximately 28%/);
    expect(note).toContain("Family Office Book");
    expect(note).toContain("elevated implied volatility");
  });
});
