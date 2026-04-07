import { describe, expect, it } from "vitest";

import { formatPortfolioAlertBodyForDisplay } from "@/lib/portfolio-alert-display";

describe("formatPortfolioAlertBodyForDisplay", () => {
  it("unwraps afp line only, keeps close and rationale", () => {
    const raw = `[afp:TSLA|2026-04-13|360|call]
[close:BUY_TO_CLOSE]

Cut losses now.`;
    expect(formatPortfolioAlertBodyForDisplay(raw)).toBe(`TSLA|2026-04-13|360|call
[close:BUY_TO_CLOSE]

Cut losses now.`);
  });

  it("strips internal |acct: ObjectId suffix from unwrapped afp line", () => {
    const acct = "507f1f77bcf86cd799439011";
    const raw = `[afp:TSLA|2026-04-13|360|call|acct:${acct}]`;
    expect(formatPortfolioAlertBodyForDisplay(raw)).toBe("TSLA|2026-04-13|360|call");
  });

  it("returns empty for undefined or blank", () => {
    expect(formatPortfolioAlertBodyForDisplay(undefined)).toBe("");
    expect(formatPortfolioAlertBodyForDisplay("   ")).toBe("");
  });
});
