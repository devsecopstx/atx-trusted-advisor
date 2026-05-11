import { describe, expect, it } from "vitest";

import {
    computeLimitResetAtIso,
    usageLimitDecisionFromResult
} from "@/modules/xchat/xchat-limit-observability";

describe("xchat-limit-observability", () => {
  it("usageLimitDecisionFromResult maps codes", () => {
    expect(usageLimitDecisionFromResult(true, undefined)).toBe("allowed");
    expect(usageLimitDecisionFromResult(false, "xchat_daily_limit_exceeded")).toBe("daily_exceeded");
    expect(usageLimitDecisionFromResult(false, "xchat_hourly_limit_exceeded")).toBe("hourly_exceeded");
    expect(usageLimitDecisionFromResult(false, "xchat_rate_limit_exceeded")).toBe("minute_exceeded");
  });

  it("computeLimitResetAtIso returns future ISO timestamp", () => {
    const before = Date.now();
    const iso = computeLimitResetAtIso(30);
    const t = new Date(iso).getTime();
    expect(t).toBeGreaterThanOrEqual(before + 29_000);
    expect(t).toBeLessThanOrEqual(before + 35_000);
  });
});
