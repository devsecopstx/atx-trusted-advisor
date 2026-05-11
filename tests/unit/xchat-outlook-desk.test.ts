import { describe, expect, it } from "vitest";

import {
    formatOutlookFreshnessLabel,
    serializeOutlookDeskForXchatShell
} from "@/lib/xchat/xchat-outlook-desk";
import type { AccountOutlookContextForXchat } from "@/modules/xchat/account-outlook-context";

const sampleCtx: AccountOutlookContextForXchat = {
  marketOutlook: "neutral",
  marketOutlookLabel: "Neutral",
  riskLevel: "balanced",
  riskLevelLabel: "Balanced",
  outlookConfidence: 0.8,
  lastOutlookRefreshAt: new Date("2026-05-10T12:00:00.000Z"),
  outlookRefreshSource: "manual",
  outlookNotes: null,
  accountOutlookRefreshEnabled: true,
  guardrailMaxPositionPct: 12,
  stableFingerprint: "abc",
  promptInjection: "desk"
};

describe("xchat-outlook-desk", () => {
  it("serializes desk outlook for shell SSR", () => {
    const desk = serializeOutlookDeskForXchatShell("507f1f77bcf86cd799439011", sampleCtx);
    expect(desk?.marketOutlookLabel).toBe("Neutral");
    expect(desk?.lastOutlookRefreshAt).toBe("2026-05-10T12:00:00.000Z");
  });

  it("formats freshness label for composer badge", () => {
    const label = formatOutlookFreshnessLabel(
      {
        marketOutlookLabel: "Neutral",
        lastOutlookRefreshAt: "2026-05-10T12:00:00.000Z"
      },
      Date.parse("2026-05-10T13:00:00.000Z")
    );
    expect(label).toContain("Neutral");
    expect(label).toContain("refreshed");
  });
});
