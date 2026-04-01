import { describe, expect, it } from "vitest";

import {
    buildXoptionsOrderReview,
    estimateOtmProbabilityPercent,
    formatExpirationShortLabel,
    formatXoptionsOrderReviewPlainText,
    normalCdf,
    XOPTIONS_REVIEW_ORDER_FOOTNOTE
} from "@/lib/xoptions/xoptions-order-preview";

describe("formatExpirationShortLabel", () => {
  it("formats YYYY-MM-DD", () => {
    const s = formatExpirationShortLabel("2026-03-15");
    expect(s).toMatch(/2026/);
    expect(s).toMatch(/15/);
  });
});

describe("normalCdf", () => {
  it("is ~0.5 at zero", () => {
    expect(normalCdf(0)).toBeGreaterThan(0.49);
    expect(normalCdf(0)).toBeLessThan(0.51);
  });
});

describe("estimateOtmProbabilityPercent", () => {
  it("returns null without IV", () => {
    expect(
      estimateOtmProbabilityPercent({
        side: "call",
        spot: 100,
        strike: 100,
        ivPercent: null,
        expirationYyyyMmDd: "2026-12-19"
      })
    ).toBeNull();
  });

  it("returns an integer percent with IV", () => {
    const p = estimateOtmProbabilityPercent({
      side: "call",
      spot: 100,
      strike: 100,
      ivPercent: 40,
      expirationYyyyMmDd: "2026-12-19"
    });
    expect(p).not.toBeNull();
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThanOrEqual(100);
  });
});

describe("buildXoptionsOrderReview", () => {
  it("includes limit, BE, prob line, and long-call narrative", () => {
    const r = buildXoptionsOrderReview({
      symbol: "NVDA",
      expirationYyyyMmDd: "2026-04-17",
      side: "call",
      strike: 177.5,
      limitPrice: "4.65",
      quantity: "10",
      spot: 175,
      impliedVolatilityPercent: 45,
      strategyLabel: null
    });
    expect(r.bidPerShareDisplay).toMatch(/\$4\.65/);
    expect(r.breakevenDisplay).toContain("$");
    expect(r.probabilityOtmDisplay).toMatch(/^\d+%$/);
    expect(r.probabilityOtmPercent).toBe(
      Number.parseInt(r.probabilityOtmDisplay.replace("%", ""), 10)
    );
    expect(r.narrative).toContain("buying 10 NVDA calls");
    expect(r.narrative).toContain("$177.50");
  });

  it("formats plain text with metrics, narrative, and footnote by default", () => {
    const r = buildXoptionsOrderReview({
      symbol: "NVDA",
      expirationYyyyMmDd: "2026-04-17",
      side: "call",
      strike: 177.5,
      limitPrice: "4.65",
      quantity: "10",
      spot: 175,
      impliedVolatilityPercent: 45,
      strategyLabel: null
    });
    const plain = formatXoptionsOrderReviewPlainText(r);
    expect(plain).toContain("xOptions — Review order");
    expect(plain).toContain("Limit (bid):");
    expect(plain).toContain(r.narrative.trim());
    expect(plain).toContain(XOPTIONS_REVIEW_ORDER_FOOTNOTE);
  });

  it("omits footnote for Ask xChat handoff when includeFootnote is false", () => {
    const r = buildXoptionsOrderReview({
      symbol: "NVDA",
      expirationYyyyMmDd: "2026-04-17",
      side: "call",
      strike: 177.5,
      limitPrice: "4.65",
      quantity: "10",
      spot: 175,
      impliedVolatilityPercent: 45,
      strategyLabel: null
    });
    const plain = formatXoptionsOrderReviewPlainText(r, { includeFootnote: false });
    expect(plain).toContain(r.narrative.trim());
    expect(plain).not.toContain(XOPTIONS_REVIEW_ORDER_FOOTNOTE);
  });

  it("uses singular option noun for qty 1", () => {
    const r = buildXoptionsOrderReview({
      symbol: "TSLA",
      expirationYyyyMmDd: "2026-06-19",
      side: "put",
      strike: 200,
      limitPrice: "5.00",
      quantity: "1",
      spot: 195,
      impliedVolatilityPercent: 50,
      strategyLabel: "Long put"
    });
    expect(r.narrative).toContain("buying 1 TSLA put ");
    expect(r.narrative).toContain("Strategy context: Long put.");
  });
});
