import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import type { Position } from "@/modules/core-admin/types";
import {
    formatHoldingsSummaryFromPositions,
    formatUserWorkspaceSummaryBlock,
    type UserWorkspaceSummaryJson
} from "@/modules/xchat/user-workspace-summary-for-prompt";

function pos(p: Partial<Position> & Pick<Position, "symbol" | "qty" | "avgCost">): Position {
  return {
    userId: "u",
    portfolioId: new ObjectId(),
    accountId: new ObjectId(),
    symbol: p.symbol,
    qty: p.qty,
    avgCost: p.avgCost,
    type: p.type,
    optionType: p.optionType,
    strike: p.strike ?? null,
    expiration: p.expiration ?? null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("formatHoldingsSummaryFromPositions", () => {
  it("formats stock lots", () => {
    const s = formatHoldingsSummaryFromPositions([
      pos({ symbol: "tsla", qty: 400, avgCost: 252.13, type: "stock" })
    ]);
    expect(s).toContain("400");
    expect(s.toUpperCase()).toContain("TSLA");
    expect(s).toContain("$252.13");
  });

  it("truncates long holdings at line and char caps", () => {
    const positions = Array.from({ length: 30 }, (_, i) =>
      pos({ symbol: `SYM${i}`, qty: 100, avgCost: 250.5 + i, type: "stock" })
    );
    const s = formatHoldingsSummaryFromPositions(positions);
    expect(s).toContain("+");
    expect(s).toContain("more position row(s)");
    expect(s.length).toBeLessThanOrEqual(420);
  });

  it("formats short option leg", () => {
    const s = formatHoldingsSummaryFromPositions([
      pos({
        symbol: "TSLA",
        qty: -1,
        avgCost: 2.5,
        type: "option",
        optionType: "call",
        strike: 465,
        expiration: new Date("2026-05-15T00:00:00.000Z")
      })
    ]);
    expect(s).toMatch(/short\s+1×\s+May\s+15\s+\$465\s+call/i);
  });
});

describe("formatUserWorkspaceSummaryBlock", () => {
  it("includes instruction + JSON fence", () => {
    const summary: UserWorkspaceSummaryJson = {
      workspace: {
        activePortfolio: "Main",
        activePortfolioId: "69f20a0253b7155c208c1808",
        nlPriceAlerts: {
          activeNlAlertCount: 2,
          alertsDeepLink: "/portfolio/alerts?portfolioId=69f20a0253b7155c208c1808"
        },
        portfolios: [
          {
            name: "Main",
            id: "69f20a0253b7155c208c1808",
            holdings: "1 TEST",
            cash: "$0.00 total (A: $0.00)",
            riskLevel: "moderate"
          }
        ]
      }
    };
    const block = formatUserWorkspaceSummaryBlock(summary);
    expect(block).toContain("User workspace summary");
    expect(block).toContain("```json");
    expect(block).toContain("activePortfolio");
    expect(block).toContain("nlPriceAlerts");
    expect(block).toContain("Never give generic multi-account");
  });
});
