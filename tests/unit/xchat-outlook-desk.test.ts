import { describe, expect, it } from "vitest";

import type { AppUserDefaultBook } from "@/lib/app-user-default-book";
import {
    formatOutlookBookScopeLabel,
    formatOutlookFreshnessLabel,
    resolveXchatOutlookBookScope,
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

  it("prefixes outlook freshness with portfolio and account", () => {
    expect(formatOutlookBookScopeLabel({ portfolioName: "HNWI Book", accountName: "IRA" })).toBe(
      "HNWI Book · IRA"
    );
    const label = formatOutlookFreshnessLabel(
      {
        marketOutlookLabel: "Neutral",
        lastOutlookRefreshAt: "2026-05-10T12:00:00.000Z",
        bookScope: { portfolioName: "HNWI Book", accountName: "IRA" }
      },
      Date.parse("2026-05-10T13:00:00.000Z")
    );
    expect(label).toMatch(/^HNWI Book · IRA — Outlook/);
  });

  it("resolves book scope from workspace book + account id", () => {
    const book: AppUserDefaultBook = {
      portfolioName: "Default",
      accountName: "Cash",
      portfolioId: "507f1f77bcf86cd799439011",
      accountId: "507f1f77bcf86cd799439022",
      accounts: [
        { id: "507f1f77bcf86cd799439022", name: "IRA", isDefault: true },
        { id: "507f1f77bcf86cd799439033", name: "Taxable", isDefault: false }
      ],
      workspacePortfolios: [
        { id: "507f1f77bcf86cd799439011", name: "Family Office", isDefault: true }
      ]
    };
    const scope = resolveXchatOutlookBookScope(
      book,
      "507f1f77bcf86cd799439011",
      "507f1f77bcf86cd799439033"
    );
    expect(scope).toEqual({ portfolioName: "Family Office", accountName: "Taxable" });
  });
});
