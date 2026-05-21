import { describe, expect, it } from "vitest";

import {
    XFINANCE_PREMIUM_CAPABILITIES,
    XFINANCE_PREMIUM_POSITIONING,
    XFINANCE_PREMIUM_TIME_VALUE,
    XFINANCE_PREMIUM_VALUE_HEADLINE
} from "@/lib/marketing/xfinance-premium-value-proposition";

describe("xFinance premium value proposition copy", () => {
  it("exports five capability pillars and Austin HNWI positioning", () => {
    expect(XFINANCE_PREMIUM_CAPABILITIES).toHaveLength(5);
    expect(XFINANCE_PREMIUM_VALUE_HEADLINE).toContain("Commands a Premium");
    expect(XFINANCE_PREMIUM_POSITIONING).toMatch(/Bloomberg Terminal/i);
    expect(XFINANCE_PREMIUM_TIME_VALUE.audience).toMatch(/\$50–300M AUM/);
  });
});
