import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminGetPortfolioById: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  adminEnsurePortfolioWatchlist: vi.fn(),
  mutatePortfolioWatchlistSymbols: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    adminGetPortfolioById: repoMocks.adminGetPortfolioById,
    getPortfolioWatchlist: repoMocks.getPortfolioWatchlist,
    adminEnsurePortfolioWatchlist: repoMocks.adminEnsurePortfolioWatchlist,
    mutatePortfolioWatchlistSymbols: repoMocks.mutatePortfolioWatchlistSymbols
  };
});

import { GET as getAdminWatchlist, PATCH as patchAdminWatchlist } from "@/app/api/admin/portfolios/[portfolioId]/watchlist/route";

const portfolioId = "507f1f77bcf86cd799439033";

function mockWatchlist() {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId("507f1f77bcf86cd799439055"),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: new ObjectId(portfolioId),
    name: "DefaultWatchlist",
    riskProfile: "balanced" as const,
    outlook: "growth" as const,
    symbols: [{ symbol: "TSLA", addedAt: now }],
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

describe("/api/admin/portfolios/[portfolioId]/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repoMocks.adminGetPortfolioById.mockResolvedValue({
      _id: new ObjectId(portfolioId),
      userId: "507f1f77bcf86cd799439011",
      name: "Book",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    repoMocks.getPortfolioWatchlist.mockResolvedValue(mockWatchlist());
    repoMocks.adminEnsurePortfolioWatchlist.mockResolvedValue(mockWatchlist());
    repoMocks.mutatePortfolioWatchlistSymbols.mockResolvedValue(mockWatchlist());
  });

  it("GET returns 404 when portfolio missing", async () => {
    repoMocks.adminGetPortfolioById.mockResolvedValueOnce(null);
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`);
    const res = await getAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(404);
  });

  it("GET returns watchlist data", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`);
    const res = await getAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: {
        name: string;
        riskProfile: string | null;
        outlook: string | null;
        symbols: { symbol: string }[];
      };
    };
    expect(json.data.name).toBe("DefaultWatchlist");
    expect(json.data.symbols).toHaveLength(1);
    expect(json.data.symbols[0]?.symbol).toBe("TSLA");
    expect(json.data.riskProfile).toBe("balanced");
    expect(json.data.outlook).toBe("growth");
    expect(repoMocks.getPortfolioWatchlist).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      portfolioId,
      tenantId: undefined
    });
  });

  it("PATCH accepts riskProfile and outlook only", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskProfile: "conservative", outlook: null })
    });
    const res = await patchAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "507f1f77bcf86cd799439011",
        portfolioId,
        riskProfile: "conservative",
        outlook: null
      })
    );
  });

  it("PATCH accepts addEntries with null line fields for row upsert", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addEntries: [
          {
            symbol: "TSLA",
            lineType: "Option",
            strategy: "covered-call",
            quantity: 100,
            entryPrice: 242.5
          }
        ]
      })
    });
    const res = await patchAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        addEntries: [
          {
            symbol: "TSLA",
            lineType: "Option",
            strategy: "covered-call",
            quantity: 100,
            entryPrice: 242.5
          }
        ]
      })
    );
  });

  it("PATCH delegates to mutatePortfolioWatchlistSymbols", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addSymbols: ["AAPL"] })
    });
    const res = await patchAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.mutatePortfolioWatchlistSymbols).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "507f1f77bcf86cd799439011",
        portfolioId,
        addSymbols: ["AAPL"]
      })
    );
  });

  it("rejects unauthenticated admin", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(NextResponse.json({ error: "nope" }, { status: 401 }));
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/watchlist`);
    const res = await getAdminWatchlist(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(401);
  });
});
