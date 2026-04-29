import { describe, expect, it } from "vitest";

import {
    buildAllAccountsBarSlices,
    buildPortfolioAllocationBarSlices
} from "@/app/portfolios/portfolios-allocation-utils";
import type { WorkspaceDashboardAccountSlice } from "@/lib/workspace-dashboard-metrics";

const slices: WorkspaceDashboardAccountSlice[] = [
  {
    portfolioId: "p1",
    portfolioName: "Book A",
    accountId: "a1",
    accountName: "ROTH",
    valueUsd: 29_000,
    riskProfile: null,
    outlook: null
  },
  {
    portfolioId: "p1",
    portfolioName: "Book A",
    accountId: "a2",
    accountName: "Rollover",
    valueUsd: 29_000,
    riskProfile: null,
    outlook: null
  },
  {
    portfolioId: "p2",
    portfolioName: "Book B",
    accountId: "a3",
    accountName: "Taxable",
    valueUsd: 52_000,
    riskProfile: null,
    outlook: null
  }
];

describe("portfolios-allocation-utils", () => {
  it("buildPortfolioAllocationBarSlices splits accounts within one portfolio", () => {
    const { total, barSlices } = buildPortfolioAllocationBarSlices("p1", slices);
    expect(total).toBe(58_000);
    expect(barSlices).toHaveLength(2);
    expect(barSlices[0]?.percent + (barSlices[1]?.percent ?? 0)).toBeCloseTo(100, 5);
  });

  it("buildAllAccountsBarSlices sorts by value descending", () => {
    const { totalUsd, barSlices } = buildAllAccountsBarSlices(slices);
    expect(totalUsd).toBe(110_000);
    expect(barSlices[0]?.valueUsd).toBe(52_000);
    expect(barSlices[0]?.label).toContain("Taxable");
  });
});
