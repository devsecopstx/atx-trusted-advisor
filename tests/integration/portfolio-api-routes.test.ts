import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getDefaultPortfolio: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  listPortfolioPositionsByAccount: vi.fn(),
  provisionDefaultPortfolioForUser: vi.fn(),
  getPortfolioWatchlist: vi.fn(),
  upsertPositionForAccount: vi.fn(),
  deletePositionForAccount: vi.fn(),
  updatePortfolioAccountForUser: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

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
    ...repositoryMocks
  };
});

import { PATCH as patchPortfolioAccount } from "@/app/api/portfolios/[portfolioId]/accounts/[accountId]/route";
import { GET as getPortfolioAccounts } from "@/app/api/portfolios/[portfolioId]/accounts/route";
import { GET as getPortfolioWatchlist } from "@/app/api/portfolios/[portfolioId]/watchlist/route";
import { GET as getDefaultPortfolio } from "@/app/api/portfolios/default/route";
import { DELETE as deletePosition } from "@/app/api/positions/[positionId]/route";
import { GET as getPositions, POST as postPosition } from "@/app/api/positions/route";
import { PositionValidationError } from "@/modules/core-admin/repository";

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
        extAccountId: "fidelity-default-account",
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
      avgCost: 190
    });
    repositoryMocks.deletePositionForAccount.mockResolvedValue(true);
    repositoryMocks.updatePortfolioAccountForUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439099" },
      userId: "507f1f77bcf86cd799439011",
      portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
      name: "Renamed",
      type: "fidelity",
      extAccountId: "fidelity-default-account",
      cashBalance: 30_000,
      isDefault: true,
      createdAt: new Date("2025-01-01T00:00:00.000Z"),
      updatedAt: new Date("2025-01-02T00:00:00.000Z")
    });
  });

  it("returns default portfolio for session user", async () => {
    const response = await getDefaultPortfolio();
    const payload = (await response.json()) as { data: { name: string } };
    expect(response.status).toBe(200);
    expect(payload.data.name).toBe("Default Portfolio");
    expect(
      (payload as { data: { ext_broker_ref?: string } }).data.ext_broker_ref
    ).toBe("extBrokerName");
    expect(
      (payload as { data: { tenantPortfolioOrgKey?: string } }).data.tenantPortfolioOrgKey
    ).toBe("org-atx-finance");
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
        avgCost: 199.25
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
        avgCost: 12.4
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
    const response = await getDefaultPortfolio();
    expect(response.status).toBe(401);
  });
});
