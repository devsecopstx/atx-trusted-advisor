import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  adminListPortfolioAlerts: vi.fn(),
  getDefaultPortfolio: vi.fn(),
  getPortfolioByIdForSessionUser: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  upsertPositionForAccount: vi.fn(),
  deletePositionForAccount: vi.fn(),
  updatePortfolioAccountForUser: vi.fn(),
  updatePortfolioForUser: vi.fn(),
  insertPortfolioAccountForUser: vi.fn(),
  deletePortfolioAccountForUser: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
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
    ...repositoryMocks,
    ensurePortfolioWatchlistForUser: async (input: {
      userId: string;
      portfolioId: string;
      tenantId?: string;
    }) => {
      let w = await repositoryMocks.getPortfolioWatchlist(input);
      if (w) {
        return w;
      }
      await repositoryMocks.provisionDefaultPortfolioForUser({
        userId: input.userId,
        tenantId: input.tenantId,
        watchlistSymbols: ["TSLA"]
      });
      w = await repositoryMocks.getPortfolioWatchlist(input);
      return w;
    }
  };
});

import {
    DELETE as deletePortfolioAccount,
    PATCH as patchPortfolioAccount
} from "@/app/api/portfolios/[portfolioId]/accounts/[accountId]/route";
import { GET as getPortfolioAccounts, POST as postPortfolioAccount } from "@/app/api/portfolios/[portfolioId]/accounts/route";
import { GET as getPortfolioAlerts } from "@/app/api/portfolios/[portfolioId]/alerts/route";
import { GET as getPortfolioById, PATCH as patchPortfolioById } from "@/app/api/portfolios/[portfolioId]/route";
import { GET as getPortfolioWatchlist } from "@/app/api/portfolios/[portfolioId]/watchlist/route";
import { GET as getCurrentPortfolio } from "@/app/api/portfolios/current/route";
import { GET as getDefaultPortfolio, POST as postDefaultPortfolio } from "@/app/api/portfolios/default/route";
import { DELETE as deletePosition } from "@/app/api/positions/[positionId]/route";
import { GET as getPositions, POST as postPosition } from "@/app/api/positions/route";
import { PositionValidationError } from "@/modules/core-admin/repository";
import { SCORING_FACTOR_IDS } from "@/modules/core-admin/scoring-factors";

describe("portfolio API routes", () => {
  beforeEach(() => {
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"]
    });
    repositoryMocks.getDefaultPortfolio.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439011",
      name: "Default Portfolio",
      isDefault: true,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z")
    });
    repositoryMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439099" },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
        name: "defaultaccount",
        type: "fidelity",
        extAccountId: "ext_account_xref",
        cashBalance: 25_000,
        isDefault: true,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z")
      }
    ]);
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValue([]);
    repositoryMocks.provisionDefaultPortfolioForUser.mockResolvedValue({
      portfolio: {
        _id: { toHexString: () => "507f1f77bcf86cd799439033" },
        userId: "507f1f77bcf86cd799439011",
        name: "Default Portfolio",
        isDefault: true,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z")
      }
    });
    repositoryMocks.getPortfolioWatchlist.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439044" },
      name: "Default Watchlist"
    });
    repositoryMocks.upsertPositionForAccount.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      symbol: "AAPL",
      qty: 2,
      avgCost: 190,
      type: "stock"
    });
    repositoryMocks.deletePositionForAccount.mockResolvedValue(true);
    repositoryMocks.updatePortfolioAccountForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      userId: "507f1f77bcf86cd799439011",
      portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
      name: "Renamed",
      type: "fidelity",
      extAccountId: "ext_account_xref",
      cashBalance: 30_000,
      isDefault: true,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z")
    });
    repositoryMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439011",
      name: "Default Portfolio",
      isDefault: true,
      tenantPortfolioOrgKey: "org-atx-finance",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z")
    });
    repositoryMocks.adminListPortfolioAlerts.mockResolvedValue([]);
    repositoryMocks.updatePortfolioForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439011",
      name: "Renamed Portfolio",
      isDefault: true,
      tenantPortfolioOrgKey: "org-atx-finance",
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z")
    });
    repositoryMocks.insertPortfolioAccountForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439088" },
      userId: "507f1f77bcf86cd799439011",
      portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
      name: "Second",
      type: "merrill",
      extAccountId: "merrill-2",
      cashBalance: 10_000,
      isDefault: false,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-01T00:00:00.000Z")
    });
  });

  it("POST /api/portfolios/default syncs and returns summary with synced flag", async () => {
    repositoryMocks.getDefaultPortfolio.mockResolvedValueOnce(null);
    repositoryMocks.listPortfolioAccounts.mockResolvedValueOnce([]);
    const response = await postDefaultPortfolio(
      new Request("http://localhost/api/portfolios/default", { method: "POST" })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { name: string }; synced: boolean };
    expect(payload.synced).toBe(true);
    expect(payload.data.name).toBe("Default Portfolio");
    expect(repositoryMocks.provisionDefaultPortfolioForUser).toHaveBeenCalled();
  });

  it("returns default portfolio for session user", async () => {
    const response = await getDefaultPortfolio(new Request("http://localhost/api/portfolios/default"));
    const payload = (await response.json()) as { data: { name: string } };
    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Default Portfolio");
    expect(
      (payload as { data: { tenantPortfolioOrgKey?: string } }).data.tenantPortfolioOrgKey
    ).toBe("org-atx-finance");
  });

  it("GET /api/portfolios/current matches default portfolio", async () => {
    const response = await getCurrentPortfolio(new Request("http://localhost/api/portfolios/current"));
    const payload = (await response.json()) as { data: { name: string } };
    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Default Portfolio");
  });

  it("GET /api/portfolios/:id returns portfolio summary when owned", async () => {
    const response = await getPortfolioById(new Request("http://test"), {
      params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data: { name: string; scoringFactors: Array<{ id: string; weight: number; label: string }> };
    };
    expect(payload.data.name).toBe("Default Portfolio");
    expect(payload.data.scoringFactors).toHaveLength(SCORING_FACTOR_IDS.length);
    expect(payload.data.scoringFactors.some((r) => r.id === "iv_rank")).toBe(true);
    expect(repositoryMocks.getPortfolioByIdForSessionUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId: "507f1f77bcf86cd799439033"
    });
  });

  it("PATCH /api/portfolios/:id updates portfolio name", async () => {
    const response = await patchPortfolioById(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Desk A" })
      }),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePortfolioForUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId: "507f1f77bcf86cd799439033",
      name: "Desk A"
    });
  });

  it("POST /api/portfolios/:id/accounts creates an account", async () => {
    const response = await postPortfolioAccount(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Second", type: "merrill", extAccountId: "merrill-2", cashBalance: 10000 })
      }),
      { params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" }) }
    );
    expect(response.status).toBe(201);
    expect(repositoryMocks.insertPortfolioAccountForUser).toHaveBeenCalled();
  });

  it("returns account list for portfolio", async () => {
    const response = await getPortfolioAccounts(new Request("http://test"), {
      params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    expect(repositoryMocks.listPortfolioAccounts).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      portfolioId: "507f1f77bcf86cd799439033",
      tenantId: "507f1f77bcf86cd799439022"
    });
  });

  it("returns watchlist for portfolio", async () => {
    const response = await getPortfolioWatchlist(new Request("http://test"), {
      params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" })
    });
    const payload = (await response.json()) as { data: { name: string } };
    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Default Watchlist");
  });

  it("returns portfolio alerts for session user", async () => {
    const response = await getPortfolioAlerts(new Request("http://test"), {
      params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
    expect(repositoryMocks.adminListPortfolioAlerts).toHaveBeenCalledWith("507f1f77bcf86cd799439033");
  });

  it("GET /api/portfolios/:id/watchlist provisions when missing then returns TSLA root", async () => {
    const ts = new Date("2025-01-01T00:00:00.000Z");
    repositoryMocks.getPortfolioWatchlist
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        _id: { toHexString: () => "507f1f77bcf86cd799439044" },
        name: "Default Watchlist",
        symbols: [{ symbol: "TSLA", addedAt: ts }]
      });
    const response = await getPortfolioWatchlist(new Request("http://test"), {
      params: Promise.resolve({ portfolioId: "507f1f77bcf86cd799439033" })
    });
    expect(response.status).toBe(200);
    expect(repositoryMocks.provisionDefaultPortfolioForUser).toHaveBeenCalled();
    const payload = (await response.json()) as {
      data: { symbols: Array<{ symbol: string }> };
    };
    expect(payload.data.symbols.some((s) => s.symbol === "TSLA")).toBe(true);
  });

  it("lists positions for an owned account", async () => {
    repositoryMocks.listPortfolioPositionsByAccount.mockResolvedValueOnce([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439055" },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
        accountId: { toHexString: () => "507f1f77bcf86cd799439099" },
        symbol: "AAPL",
        qty: 1,
        avgCost: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    const response = await getPositions(
      new Request(
        "http://test/api/positions?portfolioId=507f1f77bcf86cd799439033&accountId=507f1f77bcf86cd799439099"
      )
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data: { symbol: string }[] };
    expect(payload.data[0]?.symbol).toBe("AAPL");
  });

  it("deletes a position with portfolio and account query params", async () => {
    const response = await deletePosition(
      new Request(
        "http://test/api/positions/507f1f77bcf86cd799439055?portfolioId=507f1f77bcf86cd799439033&accountId=507f1f77bcf86cd799439099",
        { method: "DELETE" }
      ),
      { params: Promise.resolve({ positionId: "507f1f77bcf86cd799439055" }) }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.deletePositionForAccount).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId: "507f1f77bcf86cd799439033",
      accountId: "507f1f77bcf86cd799439099",
      positionId: "507f1f77bcf86cd799439055"
    });
  });

  it("DELETE /api/portfolios/:id/accounts/:accountId removes an account when more than one exists", async () => {
    repositoryMocks.listPortfolioAccounts.mockResolvedValueOnce([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439099" },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
        name: "defaultaccount",
        type: "fidelity",
        extAccountId: "ext_account_xref",
        cashBalance: 25_000,
        isDefault: true,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z")
      },
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439088" },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
        name: "second",
        type: "merrill",
        extAccountId: "ext2",
        cashBalance: 10_000,
        isDefault: false,
        createdAt: new Date("2025-01-01T00:00:00.000Z"),
        updatedAt: new Date("2025-01-01T00:00:00.000Z")
      }
    ]);
    repositoryMocks.deletePortfolioAccountForUser.mockResolvedValueOnce(true);
    const response = await deletePortfolioAccount(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({
        portfolioId: "507f1f77bcf86cd799439033",
        accountId: "507f1f77bcf86cd799439088"
      })
    });
    expect(response.status).toBe(200);
    expect(repositoryMocks.deletePortfolioAccountForUser).toHaveBeenCalledWith({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      portfolioId: "507f1f77bcf86cd799439033",
      accountId: "507f1f77bcf86cd799439088"
    });
  });

  it("patches account metadata for an owned account", async () => {
    const response = await patchPortfolioAccount(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed", cashBalance: 30_000 })
      }),
      {
        params: Promise.resolve({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099"
        })
      }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePortfolioAccountForUser).toHaveBeenCalled();
  });

  it("patches desk fields riskProfile and outlook for an owned account", async () => {
    const response = await patchPortfolioAccount(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskProfile: "balanced", outlook: "bullish" })
      }),
      {
        params: Promise.resolve({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099"
        })
      }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePortfolioAccountForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        riskProfile: "balanced",
        outlook: "bullish"
      })
    );
  });

  it("PATCH account accepts legacy outlook slug and maps to canonical value", async () => {
    const response = await patchPortfolioAccount(
      new Request("http://test", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlook: "growth" })
      }),
      {
        params: Promise.resolve({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099"
        })
      }
    );
    expect(response.status).toBe(200);
    expect(repositoryMocks.updatePortfolioAccountForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        outlook: "bullish"
      })
    );
  });

  it("maps position validation errors to HTTP status codes", async () => {
    repositoryMocks.upsertPositionForAccount.mockRejectedValueOnce(
      new PositionValidationError(
        "ACCOUNT_PORTFOLIO_MISMATCH",
        "Account does not belong to the specified portfolio"
      )
    );

    const response = await postPosition(
      new Request("http://test/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439044",
          symbol: "AAPL",
          qty: 2,
          avgCost: 190
        })
      })
    );
    expect(response.status).toBe(404);
  });

  it("accepts OpenAPI-style position payload for account quick add", async () => {
    const response = await postPosition(
      new Request("http://test/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099",
          type: "stock",
          ticker: "tsla",
          shares: 5,
          purchasePrice: 199.25
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.upsertPositionForAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: "507f1f77bcf86cd799439033",
        accountId: "507f1f77bcf86cd799439099",
        symbol: "TSLA",
        qty: 5,
        avgCost: 199.25,
        type: "stock"
      })
    );
  });

  it("accepts OpenAPI option payload with contracts and option metadata", async () => {
    const response = await postPosition(
      new Request("http://test/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099",
          type: "option",
          ticker: "tsla",
          contracts: 2,
          optionType: "call",
          strike: 250,
          expiration: "2026-12-18",
          purchasePrice: 12.4
        })
      })
    );

    expect(response.status).toBe(201);
    expect(repositoryMocks.upsertPositionForAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: "507f1f77bcf86cd799439033",
        accountId: "507f1f77bcf86cd799439099",
        symbol: "TSLA",
        qty: 2,
        avgCost: 12.4,
        type: "option"
      })
    );
  });

  it("rejects option payload when expiration is not a future date", async () => {
    const now = new Date();
    const pastDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1))
      .toISOString()
      .slice(0, 10);

    const response = await postPosition(
      new Request("http://test/api/positions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          accountId: "507f1f77bcf86cd799439099",
          type: "option",
          ticker: "tsla",
          contracts: 2,
          optionType: "call",
          strike: 250,
          expiration: pastDate,
          purchasePrice: 12.4
        })
      })
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { error?: string };
    expect(payload.error).toContain("future date");
  });

  it("returns 401 when default portfolio route has no session", async () => {
    sessionMocks.requireSessionUser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await getDefaultPortfolio(new Request("http://localhost/api/portfolios/default"));
    expect(response.status).toBe(401);
  });
});
