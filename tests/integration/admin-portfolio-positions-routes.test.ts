import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminListPositionsForPortfolioAccount: vi.fn(),
  adminUpsertPositionForPortfolioAccount: vi.fn(),
  adminDeletePositionForPortfolioAccount: vi.fn(),
  adminGetPortfolioById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    adminListPositionsForPortfolioAccount: repoMocks.adminListPositionsForPortfolioAccount,
    adminUpsertPositionForPortfolioAccount: repoMocks.adminUpsertPositionForPortfolioAccount,
    adminDeletePositionForPortfolioAccount: repoMocks.adminDeletePositionForPortfolioAccount,
    adminGetPortfolioById: repoMocks.adminGetPortfolioById
  };
});

import { DELETE as deleteAdminPosition } from "@/app/api/admin/portfolios/[portfolioId]/accounts/[accountId]/positions/[positionId]/route";
import { GET as getAdminPositions, POST as postAdminPosition } from "@/app/api/admin/portfolios/[portfolioId]/accounts/[accountId]/positions/route";

const portfolioId = "507f1f77bcf86cd799439033";
const accountId = "507f1f77bcf86cd799439044";
const positionId = "507f1f77bcf86cd799439055";

function mockPosition(
  overrides: Partial<{
    symbol: string;
    qty: number;
    avgCost: number;
    type: "stock" | "option" | "cash";
    yahooRef: string;
    optionType: "call" | "put";
    strike: number;
    expiration: Date;
  }> = {}
) {
  const now = new Date("2026-01-15T12:00:00.000Z");
  const type = overrides.type ?? "stock";
  const base = {
    _id: new ObjectId(positionId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: new ObjectId(portfolioId),
    accountId: new ObjectId(accountId),
    createdAt: now,
    updatedAt: now
  };
  if (type === "option") {
    return {
      ...base,
      type: "option" as const,
      symbol: overrides.symbol ?? "TSLA",
      qty: overrides.qty ?? 2,
      avgCost: overrides.avgCost ?? 12.4,
      yahooRef: overrides.yahooRef ?? "TSLA261218C00250000",
      optionType: overrides.optionType ?? ("call" as const),
      strike: overrides.strike ?? 250,
      expiration: overrides.expiration ?? new Date("2026-12-18T00:00:00.000Z")
    };
  }
  if (type === "cash") {
    return {
      ...base,
      type: "cash" as const,
      symbol: overrides.symbol ?? "CASH",
      qty: 1,
      avgCost: overrides.avgCost ?? 5000
    };
  }
  return {
    ...base,
    type: "stock" as const,
    symbol: overrides.symbol ?? "TSLA",
    qty: overrides.qty ?? 10,
    avgCost: overrides.avgCost ?? 200
  };
}

function mockPortfolioForAccess() {
  return {
    _id: new ObjectId(portfolioId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    name: "Desk A",
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe("/api/admin/portfolios/[portfolioId]/accounts/[accountId]/positions", () => {
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
    repoMocks.adminGetPortfolioById.mockResolvedValue(mockPortfolioForAccess());
  });

  it("GET returns 404 when bundle is null", async () => {
    repoMocks.adminListPositionsForPortfolioAccount.mockResolvedValueOnce(null);
    const res = await getAdminPositions(new Request("http://test"), {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(404);
  });

  it("GET returns positions and account meta", async () => {
    const pos = mockPosition();
    repoMocks.adminListPositionsForPortfolioAccount.mockResolvedValueOnce({
      portfolio: {
        _id: new ObjectId(portfolioId),
        userId: "507f1f77bcf86cd799439011",
        name: "Desk A",
        isDefault: true,
        tenantPortfolioOrgKey: "org",
        createdAt: new Date(),
        updatedAt: new Date()
      },
      account: {
        _id: new ObjectId(accountId),
        userId: "507f1f77bcf86cd799439011",
        portfolioId: new ObjectId(portfolioId),
        name: "Primary",
        type: "fidelity" as const,
        extAccountId: "ext-1",
        cashBalance: 25_000,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      positions: [pos]
    });
    const res = await getAdminPositions(new Request("http://test"), {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { portfolioName: string; positions: { _id: string; symbol: string; type: string }[] };
    };
    expect(body.data.portfolioName).toBe("Desk A");
    expect(body.data.positions).toHaveLength(1);
    expect(body.data.positions[0].symbol).toBe("TSLA");
    expect(body.data.positions[0].type).toBe("stock");
    expect(body.data.positions[0]).toMatchObject({ shares: 10, purchasePrice: 200 });
  });

  it("POST upserts detailed stock and returns 201", async () => {
    const pos = mockPosition({ symbol: "AAPL", qty: 5, avgCost: 180 });
    repoMocks.adminUpsertPositionForPortfolioAccount.mockResolvedValueOnce(pos);
    const res = await postAdminPosition(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "stock", symbol: "aapl", shares: 5, purchasePrice: 180 })
      }),
      { params: Promise.resolve({ portfolioId, accountId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminUpsertPositionForPortfolioAccount).toHaveBeenCalledWith({
      portfolioId,
      accountId,
      symbol: "AAPL",
      qty: 5,
      avgCost: 180,
      type: "stock"
    });
  });

  it("POST upserts legacy compact stock body", async () => {
    const pos = mockPosition({ symbol: "AAPL", qty: 5, avgCost: 180 });
    repoMocks.adminUpsertPositionForPortfolioAccount.mockResolvedValueOnce(pos);
    const res = await postAdminPosition(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: "aapl", qty: 5, avgCost: 180 })
      }),
      { params: Promise.resolve({ portfolioId, accountId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminUpsertPositionForPortfolioAccount).toHaveBeenCalledWith({
      portfolioId,
      accountId,
      symbol: "AAPL",
      qty: 5,
      avgCost: 180,
      type: "stock"
    });
  });

  it("POST upserts detailed cash (amount) payload", async () => {
    const pos = mockPosition({ type: "cash", avgCost: 5000 });
    repoMocks.adminUpsertPositionForPortfolioAccount.mockResolvedValueOnce(pos);
    const res = await postAdminPosition(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "cash", amount: 5000 })
      }),
      { params: Promise.resolve({ portfolioId, accountId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminUpsertPositionForPortfolioAccount).toHaveBeenCalledWith({
      portfolioId,
      accountId,
      type: "cash",
      symbol: "CASH",
      qty: 1,
      avgCost: 5000
    });
  });

  it("POST upserts detailed option payload", async () => {
    const pos = mockPosition({
      type: "option",
      symbol: "TSLA",
      qty: 3,
      avgCost: 4.5,
      yahooRef: "TSLA261218C00250000",
      strike: 250,
      expiration: new Date("2026-12-18T00:00:00.000Z")
    });
    repoMocks.adminUpsertPositionForPortfolioAccount.mockResolvedValueOnce(pos);
    const res = await postAdminPosition(
      new Request("http://test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "option",
          symbol: "tsla",
          yahooRef: "TSLA261218C00250000",
          optionType: "call",
          strike: 250,
          expiration: "2026-12-18",
          contracts: 3,
          premiumPerContract: 4.5
        })
      }),
      { params: Promise.resolve({ portfolioId, accountId }) }
    );
    expect(res.status).toBe(201);
    expect(repoMocks.adminUpsertPositionForPortfolioAccount).toHaveBeenCalledWith({
      portfolioId,
      accountId,
      type: "option",
      symbol: "TSLA",
      qty: 3,
      avgCost: 4.5,
      yahooRef: "TSLA261218C00250000",
      optionType: "call",
      strike: 250,
      expiration: new Date(Date.UTC(2026, 11, 18))
    });
  });

  it("DELETE returns 404 when not deleted", async () => {
    repoMocks.adminDeletePositionForPortfolioAccount.mockResolvedValueOnce(false);
    const res = await deleteAdminPosition(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ portfolioId, accountId, positionId })
    });
    expect(res.status).toBe(404);
  });

  it("DELETE returns 200 when deleted", async () => {
    repoMocks.adminDeletePositionForPortfolioAccount.mockResolvedValueOnce(true);
    const res = await deleteAdminPosition(new Request("http://test", { method: "DELETE" }), {
      params: Promise.resolve({ portfolioId, accountId, positionId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminDeletePositionForPortfolioAccount).toHaveBeenCalledWith({
      portfolioId,
      accountId,
      positionId
    });
  });
});
