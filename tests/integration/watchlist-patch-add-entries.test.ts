import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const mutateMocks = vi.hoisted(() => ({
  mutatePortfolioWatchlistSymbols: vi.fn()
}));

const watchlistReadMocks = vi.hoisted(() => ({
  /** Satisfies GET/PATCH ensure path without hitting Mongo in tests. */
  getPortfolioWatchlist: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    getPortfolioWatchlist: watchlistReadMocks.getPortfolioWatchlist,
    mutatePortfolioWatchlistSymbols: mutateMocks.mutatePortfolioWatchlistSymbols
  };
});

import { PATCH as patchWatchlist } from "@/app/api/portfolios/[portfolioId]/watchlist/route";

describe("PATCH /api/portfolios/:portfolioId/watchlist addEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const addedAt = new Date("2026-01-15T00:00:00.000Z");
    watchlistReadMocks.getPortfolioWatchlist.mockResolvedValue({
      _id: new ObjectId(),
      userId: "507f1f77bcf86cd799439011",
      portfolioId: new ObjectId("507f1f77bcf86cd799439033"),
      name: "Default",
      isDefault: true,
      createdAt: addedAt,
      updatedAt: addedAt,
      symbols: [{ symbol: "TSLA", addedAt }]
    });
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["viewer"],
      email: "u@test.local",
      tenantRole: "tenant_member",
      xUserId: "x1",
      username: "user1"
    });
  });

  it("forwards addEntries to mutatePortfolioWatchlistSymbols and returns metadata in JSON", async () => {
    const addedAt = new Date("2026-01-15T00:00:00.000Z");
    mutateMocks.mutatePortfolioWatchlistSymbols.mockResolvedValue({
      _id: new ObjectId(),
      tenantId: new ObjectId(),
      userId: "507f1f77bcf86cd799439011",
      portfolioId: new ObjectId(),
      name: "Default",
      isDefault: true,
      createdAt: addedAt,
      updatedAt: addedAt,
      symbols: [
        {
          symbol: "TSLA",
          addedAt,
          lineType: "Stock",
          strategy: "Long",
          quantity: 100,
          entryPrice: 250.5
        }
      ]
    });

    const res = await patchWatchlist(
      new Request("http://test/api/portfolios/p1/watchlist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addEntries: [
            {
              symbol: "TSLA",
              lineType: "Stock",
              strategy: "Long",
              quantity: 100,
              entryPrice: 250.5
            }
          ]
        })
      }),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );

    expect(res.status).toBe(200);
    expect(mutateMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        addEntries: [
          {
            symbol: "TSLA",
            lineType: "Stock",
            strategy: "Long",
            quantity: 100,
            entryPrice: 250.5
          }
        ]
      })
    );
    const json = (await res.json()) as {
      data: { symbols: Array<{ symbol: string; lineType?: string; entryPrice?: number }> };
    };
    expect(json.data.symbols[0]?.symbol).toBe("TSLA");
    expect(json.data.symbols[0]?.lineType).toBe("Stock");
    expect(json.data.symbols[0]?.entryPrice).toBe(250.5);
  });

  it("returns 400 when payload has no mutation fields", async () => {
    const res = await patchWatchlist(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );
    expect(res.status).toBe(400);
    expect(mutateMocks.mutatePortfolioWatchlistSymbols).not.toHaveBeenCalled();
  });

  it("returns 401-shaped response when session is unauthenticated", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const res = await patchWatchlist(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addEntries: [{ symbol: "X" }] })
      }),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );
    expect(res.status).toBe(401);
  });
});
