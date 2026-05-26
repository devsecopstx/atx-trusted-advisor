import { describe, expect, it } from "vitest";

import { parseXoptionsBuilderDeskDeepLinkStep } from "@/lib/xoptions/xoptions-builder-url";

describe("parseXoptionsBuilderDeskDeepLinkStep", () => {
  it("returns 3, 4, or 5 for desk deep-links", () => {
    expect(parseXoptionsBuilderDeskDeepLinkStep(new URLSearchParams("symbol=HAWK&step=3"))).toBe(3);
    expect(
      parseXoptionsBuilderDeskDeepLinkStep(
        new URLSearchParams("symbol=HAWK&step=4&expiration=2026-06-18&strike=50&contractType=call")
      )
    ).toBe(4);
    expect(parseXoptionsBuilderDeskDeepLinkStep(new URLSearchParams("step=5"))).toBe(5);
  });

  it("returns null for other steps or missing step", () => {
    expect(parseXoptionsBuilderDeskDeepLinkStep(new URLSearchParams("step=2"))).toBeNull();
    expect(parseXoptionsBuilderDeskDeepLinkStep(new URLSearchParams("symbol=TSLA"))).toBeNull();
  });
});
