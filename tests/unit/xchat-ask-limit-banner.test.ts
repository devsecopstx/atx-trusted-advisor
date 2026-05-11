import { describe, expect, it } from "vitest";

import {
    buildXchatAskLimitBannerMarkdown,
    isXchatUsageLimitCode
} from "@/app/xchat/ui/xchat-ask-limit-banner";

describe("xchat ask limit banner", () => {
  it("recognizes workspace usage limit codes", () => {
    expect(isXchatUsageLimitCode("xchat_daily_limit_exceeded")).toBe(true);
    expect(isXchatUsageLimitCode("xchat_hourly_limit_exceeded")).toBe(true);
    expect(isXchatUsageLimitCode("xchat_rate_limit_exceeded")).toBe(true);
    expect(isXchatUsageLimitCode("request_aborted")).toBe(false);
  });

  it("builds friendly daily cap copy with plan link", () => {
    const markdown = buildXchatAskLimitBannerMarkdown({
      code: "xchat_daily_limit_exceeded",
      error: "Daily prompt limit reached for your workspace (UTC calendar day).",
      dailyLimit: 25,
      contactAdmin: true,
      responseStatus: 429
    });
    expect(markdown).toContain("**Daily limit reached**");
    expect(markdown).toContain("Workspace daily cap: **25**");
    expect(markdown).toContain("[Account → Billing](/account/billing)");
  });
});
