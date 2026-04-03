import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repositoryMocks = vi.hoisted(() => ({
  getPortfolioByIdForSessionUser: vi.fn(),
  listPortfolioAccounts: vi.fn(),
  deletePositionsForPortfolioAccount: vi.fn(),
  upsertPositionForAccount: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repositoryMocks
  };
});

import { POST as postBrokerImport } from "@/app/api/admin/import/broker/route";

const MERRILL_HEADER = "Symbol,Quantity,Account #\n";

describe("POST /api/admin/import/broker", () => {
  beforeEach(() => {
    authMocks.requireAdminSession.mockResolvedValue({
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      roles: ["global_admin"],
      email: "admin@test.local",
      tenantRole: "tenant_admin",
      xUserId: "x1",
      username: "adminuser"
    });
    repositoryMocks.getPortfolioByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: "507f1f77bcf86cd799439011",
      name: "Default Portfolio",
      isDefault: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    repositoryMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: { toHexString: () => "507f1f77bcf86cd799439099" },
        userId: "507f1f77bcf86cd799439011",
        portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" },
        name: "defaultaccount",
        type: "merrill",
        extAccountId: "51X-98940",
        cashBalance: 0,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    repositoryMocks.deletePositionsForPortfolioAccount.mockResolvedValue(2);
    repositoryMocks.upsertPositionForAccount.mockResolvedValue({
      _id: { toHexString: () => "507f1f77bcf86cd799439055" },
      symbol: "TSLA",
      qty: 10,
      avgCost: 100
    });
  });

  it("returns preview for dryRun Merrill holdings CSV", async () => {
    const csv = `${MERRILL_HEADER}TSLA,10,51X-98940\n`;
    const response = await postBrokerImport(
      new Request("http://test/api/admin/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv,
          mappings: {},
          dryRun: true
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      dryRun: boolean;
      accounts: Array<{ accountRef: string; stockCount: number }>;
    };
    expect(payload.dryRun).toBe(true);
    expect(payload.accounts[0]?.accountRef).toBe("51X-98940");
    expect(payload.accounts[0]?.stockCount).toBe(1);
    expect(repositoryMocks.deletePositionsForPortfolioAccount).not.toHaveBeenCalled();
  });

  it("imports stock lots when mappings are valid", async () => {
    const csv = `${MERRILL_HEADER}TSLA,10,51X-98940\n`;
    const response = await postBrokerImport(
      new Request("http://test/api/admin/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv,
          mappings: { "51X-98940": "507f1f77bcf86cd799439099" },
          dryRun: false
        })
      })
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      results: Array<{ imported: number; skippedNonStock: number }>;
    };
    expect(payload.results[0]?.imported).toBe(1);
    expect(payload.results[0]?.skippedNonStock).toBe(0);
    expect(repositoryMocks.upsertPositionForAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: "507f1f77bcf86cd799439033",
        accountId: "507f1f77bcf86cd799439099",
        symbol: "TSLA",
        qty: 10,
        type: "stock"
      })
    );
  });

  it("returns 401 without admin session", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await postBrokerImport(
      new Request("http://test/api/admin/import/broker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolioId: "507f1f77bcf86cd799439033",
          broker: "merrill",
          exportType: "holdings",
          csv: `${MERRILL_HEADER}A,1,B\n`,
          dryRun: true
        })
      })
    );
    expect(response.status).toBe(401);
  });
});
