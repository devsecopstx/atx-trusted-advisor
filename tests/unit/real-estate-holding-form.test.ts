import { describe, expect, it } from "vitest";

import {
    computeFormNetEquityPreview,
    defaultRealEstateHoldingFormValues,
    redfinEstimateSearchUrl,
    validateRealEstateHoldingForm,
    zillowEstimateSearchUrl
} from "@/lib/real-estate-holding-form";

describe("real-estate public estimate URLs", () => {
  it("builds Zillow deep link from address", () => {
    const url = zillowEstimateSearchUrl("123 Lakeview Dr, Austin, TX 78734");
    expect(url).toContain("zillow.com/homes/");
    expect(url).toContain(encodeURIComponent("123-Lakeview-Dr-Austin-TX-78734"));
  });

  it("builds Redfin search from address", () => {
    const url = redfinEstimateSearchUrl("123 Lakeview Dr, Austin, TX");
    expect(url).toContain("redfin.com/homes?search=");
    expect(url).toContain(encodeURIComponent("123 Lakeview Dr, Austin, TX"));
  });

  it("falls back to home pages when address empty", () => {
    expect(zillowEstimateSearchUrl("")).toBe("https://www.zillow.com/");
    expect(redfinEstimateSearchUrl("  ")).toBe("https://www.redfin.com/");
  });
});

describe("validateRealEstateHoldingForm", () => {
  const portfolioId = "507f1f77bcf86cd799439011";
  const accountId = "507f1f77bcf86cd799439012";

  it("accepts full manual payload with mortgage and zestimate source", () => {
    const values = {
      ...defaultRealEstateHoldingFormValues(),
      holdingName: "Lake Travis — Primary",
      address: "123 Lakeview Dr, Austin, TX",
      currentValueUsd: "2,850,000",
      valuationDate: "2026-05-20",
      ownershipPct: "100",
      mortgageBalanceUsd: "920,000",
      valuationSource: "zestimate_user_verified" as const,
      notes: "illiquid"
    };
    const result = validateRealEstateHoldingForm(values, portfolioId, accountId);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.payload.valuationSource).toBe("zestimate_user_verified");
    expect(result.payload.currentValueUsd).toBe(2_850_000);
    expect(result.payload.metadata?.mortgageBalanceUsd).toBe(920_000);
  });

  it("requires other type label when property type is other", () => {
    const values = {
      ...defaultRealEstateHoldingFormValues(),
      holdingName: "Vineyard",
      propertyType: "other" as const,
      currentValueUsd: "500000",
      valuationDate: "2026-05-20"
    };
    const result = validateRealEstateHoldingForm(values, portfolioId, accountId);
    expect(result.ok).toBe(false);
  });
});

describe("computeFormNetEquityPreview", () => {
  it("mirrors desk net equity math", () => {
    const values = {
      ...defaultRealEstateHoldingFormValues(),
      currentValueUsd: "1000000",
      ownershipPct: "50",
      mortgageBalanceUsd: "200000"
    };
    expect(computeFormNetEquityPreview(values)).toBe(300_000);
  });
});
