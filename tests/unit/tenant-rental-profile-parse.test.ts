import { describe, expect, it } from "vitest";

import { parseTenantRentalProfile } from "@/modules/platform/tenant-rental-profile";

describe("parseTenantRentalProfile", () => {
  it("returns undefined when absent", () => {
    expect(parseTenantRentalProfile(undefined)).toBeUndefined();
    expect(parseTenantRentalProfile(null)).toBeUndefined();
  });

  it("applies defaults for optional numeric/boolean fields", () => {
    const r = parseTenantRentalProfile({
      tier: "ai-advisor-pro",
      expiresAt: "2027-01-01T00:00:00.000Z"
    });
    expect(r?.tier).toBe("ai-advisor-pro");
    expect(r?.strategyBias).toBe("conservative");
    expect(r?.maxPortfolios).toBe(3);
    expect(r?.maxDailyTokens).toBe(200_000);
    expect(r?.apiKeyEnabled).toBe(true);
    expect(r?.expiresAt.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("parses bias and overrides", () => {
    const r = parseTenantRentalProfile({
      tier: "enterprise",
      strategyBias: "AGGRESSIVE",
      maxPortfolios: 5,
      maxDailyTokens: 200_000,
      xaiModelOverride: "grok-4-20",
      expiresAt: "2026-12-31T23:59:59Z",
      apiKeyEnabled: false
    });
    expect(r?.strategyBias).toBe("aggressive");
    expect(r?.maxPortfolios).toBe(5);
    expect(r?.maxDailyTokens).toBe(200_000);
    expect(r?.xaiModelOverride).toBe("grok-4-20");
    expect(r?.apiKeyEnabled).toBe(false);
  });

  it("rejects invalid bias", () => {
    expect(() =>
      parseTenantRentalProfile({
        tier: "x",
        expiresAt: "2027-01-01T00:00:00.000Z",
        strategyBias: "yolo"
      })
    ).toThrow(/strategyBias/);
  });
});
