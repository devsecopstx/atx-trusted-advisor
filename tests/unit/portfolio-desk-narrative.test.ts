import { describe, expect, it } from "vitest";

import { portfolioDeskNarrativeLine } from "@/lib/portfolio-desk-narrative";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

function slice(
  overrides: Partial<WorkspaceDashboardAccountSlice> & Pick<WorkspaceDashboardAccountSlice, "portfolioId" | "accountId">
): WorkspaceDashboardAccountSlice {
  return {
    portfolioName: "P",
    accountName: "Acct",
    valueUsd: 10_000,
    riskProfile: null,
    outlook: null,
    ...overrides
  };
}

describe("portfolioDeskNarrativeLine", () => {
  it("combines outlook and risk when both set (single account)", () => {
    const line = portfolioDeskNarrativeLine(
      [
        slice({
          portfolioId: "p1",
          accountId: "a1",
          outlook: "bullish",
          riskProfile: "growth",
          valueUsd: 50_000
        })
      ],
      "p1"
    );
    expect(line).toContain("Bullish / up");
    expect(line).toContain("Aggressive");
    expect(line).not.toContain("book-weighted");
  });

  it("book-weights dominant outlook across accounts", () => {
    const line = portfolioDeskNarrativeLine(
      [
        slice({
          portfolioId: "p1",
          accountId: "a1",
          outlook: "bearish",
          riskProfile: "balanced",
          valueUsd: 90_000
        }),
        slice({
          portfolioId: "p1",
          accountId: "a2",
          outlook: "bullish",
          riskProfile: "balanced",
          valueUsd: 10_000
        })
      ],
      "p1"
    );
    expect(line).toContain("Bearish / down");
    expect(line).toContain("book-weighted");
  });

  it("prompts to set desk fields when missing", () => {
    const line = portfolioDeskNarrativeLine(
      [slice({ portfolioId: "p1", accountId: "a1", outlook: null, riskProfile: null })],
      "p1"
    );
    expect(line).toMatch(/Set market outlook/i);
  });
});
