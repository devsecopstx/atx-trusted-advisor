import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  adminCreatePortfolioAlert: vi.fn(),
  ensurePortfolioWatchlistForUser: vi.fn(),
  getDefaultPortfolio: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn()
}));

vi.mock("@/lib/auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => repositoryMocks);

import { POST as postApplyWatchlist } from "@/app/api/reports/scan/apply-watchlist/route";

function buildPayload(overrides?: Partial<Record<string, unknown>>) {
  const base = {
    row: {
      rowId: "watchlist:TSLA:na:na:OPEN:0",
      source: "watchlist",
      symbol: "TSLA",
      recommendedAction: "OPEN",
      why: "Spot is near entry zone.",
      urgency: "med",
      targetWindow: "this week",
      confidence: "medium",
      applyToWatchlist: {
        type: "apply_to_watchlist",
        symbol: "TSLA",
        allowPriceAlert: true,
        defaultPriceAlertSeverity: "info"
      }
    },
    ...overrides
  };
  return base;
}

describe("POST /api/reports/scan/apply-watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "viewer@atxfinance.ai",
      username: "viewer",
      roles: ["viewer"]
    });
    repositoryMocks.getDefaultPortfolio.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439055")
    });
    repositoryMocks.ensurePortfolioWatchlistForUser.mockResolvedValue({
      name: "Default watchlist",
      symbols: [],
      riskProfile: undefined,
      outlook: undefined
    });
    repositoryMocks.mutatePortfolioWatchlistSymbols.mockResolvedValue({
      name: "Default watchlist",
      symbols: [{ symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00.000Z") }]
    });
    repositoryMocks.adminCreatePortfolioAlert.mockResolvedValue({
      _id: new ObjectId("507f1f77bcf86cd799439099"),
      title: "TSLA watchlist alert from options scan",
      body: "TSLA scan signal: OPEN.",
      severity: "info",
      symbol: "TSLA",
      createdAt: new Date("2026-01-01T00:00:00.000Z")
    });
    repositoryMocks.provisionDefaultPortfolioForUser.mockResolvedValue({
      portfolio: { _id: new ObjectId("507f1f77bcf86cd799439055") }
    });
  });

  it("returns 400 on invalid payload", async () => {
    const response = await postApplyWatchlist(
      new Request("http://test/api/reports/scan/apply-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row: { rowId: "" } })
      })
    );
    expect(response.status).toBe(400);
  });

  it("upserts watchlist entry and creates price alert in one mutation flow", async () => {
    const response = await postApplyWatchlist(
      new Request("http://test/api/reports/scan/apply-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildPayload({
            createPriceAlert: true,
            priceAlertMinAbsMovePercent: 6
          })
        )
      })
    );
    expect(response.status).toBe(200);

    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        addEntries: [
          expect.objectContaining({
            symbol: "TSLA",
            lineType: "Stock",
            strategy: "balanced",
            priceAlertMinAbsMovePercent: 6
          })
        ],
        riskProfile: "growth",
        outlook: "neutral"
      })
    );
    expect(repositoryMocks.adminCreatePortfolioAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: "TSLA",
        severity: "info"
      })
    );
    const payload = (await response.json()) as { data: { priceAlert: { _id: string } | null } };
    expect(payload.data.priceAlert?._id).toBe("507f1f77bcf86cd799439099");
  });

  it("updates existing watchlist row without creating alert", async () => {
    repositoryMocks.ensurePortfolioWatchlistForUser.mockResolvedValueOnce({
      name: "Default watchlist",
      symbols: [{ symbol: "TSLA", addedAt: new Date("2026-01-01T00:00:00.000Z") }],
      riskProfile: "balanced",
      outlook: "neutral"
    });

    const response = await postApplyWatchlist(
      new Request("http://test/api/reports/scan/apply-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload({ createPriceAlert: false }))
      })
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        addEntries: [
          expect.objectContaining({
            symbol: "TSLA",
            rowStatus: "review"
          })
        ]
      })
    );
    expect(repositoryMocks.adminCreatePortfolioAlert).not.toHaveBeenCalled();
  });

  it("returns session response when unauthorized", async () => {
    authMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postApplyWatchlist(
      new Request("http://test/api/reports/scan/apply-watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload())
      })
    );
    expect(response.status).toBe(401);
  });
});
