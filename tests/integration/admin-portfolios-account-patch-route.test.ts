import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminUpdatePortfolioAccount: vi.fn(),
  adminGetPortfolioById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    // Keep this suite hermetic: avoid live backend proxy calls from env bleed.
    proxyAdminUsersRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});
vi.mock("@/modules/core-admin/repository", () => ({
  adminUpdatePortfolioAccount: repoMocks.adminUpdatePortfolioAccount,
  adminGetPortfolioById: repoMocks.adminGetPortfolioById,
  adminDeleteAccountForPortfolio: vi.fn(),
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000
}));

import { PATCH as patchAdminPortfolioAccount } from "@/app/api/admin/portfolios/[portfolioId]/accounts/[accountId]/route";

const portfolioId = "507f1f77bcf86cd799439033";
const accountId = "507f1f77bcf86cd799439044";

function mockPortfolioForScope() {
  const pid = new ObjectId(portfolioId);
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: pid,
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    name: "Book",
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

function mockAccount(overrides: Partial<{ name: string; extAccountId: string }> = {}) {
  const pid = new ObjectId(portfolioId);
  const aid = new ObjectId(accountId);
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: aid,
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    portfolioId: pid,
    name: overrides.name ?? "Default Account",
    type: "fidelity" as const,
    extAccountId: overrides.extAccountId ?? "ext-1",
    cashBalance: 10_000,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

describe("PATCH /api/admin/portfolios/[portfolioId]/accounts/[accountId]", () => {
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
    repoMocks.adminUpdatePortfolioAccount.mockResolvedValue(mockAccount({ name: "Renamed" }));
    repoMocks.adminGetPortfolioById.mockResolvedValue(mockPortfolioForScope());
  });

  it("updates account when payload has name", async () => {
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Renamed" })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { name: string } };
    expect(json.data.name).toBe("Renamed");
    expect(repoMocks.adminUpdatePortfolioAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        accountId,
        name: "Renamed"
      })
    );
  });

  it("treats blank extAccountId as omitted so name-only patches still validate", async () => {
    repoMocks.adminUpdatePortfolioAccount.mockResolvedValueOnce(
      mockAccount({ name: "Acct", extAccountId: "ext-1" })
    );
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New label", extAccountId: "   " })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdatePortfolioAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New label",
        extAccountId: undefined
      })
    );
  });

  it("updates account when payload has outlook slug only", async () => {
    repoMocks.adminUpdatePortfolioAccount.mockResolvedValueOnce({
      ...mockAccount(),
      outlook: "bearish" as const
    });
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outlook: "bearish" })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdatePortfolioAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        accountId,
        outlook: "bearish"
      })
    );
  });

  it("updates account when payload has riskProfile only", async () => {
    repoMocks.adminUpdatePortfolioAccount.mockResolvedValueOnce({
      ...mockAccount(),
      riskProfile: "balanced" as const
    });
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskProfile: "balanced" })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdatePortfolioAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        accountId,
        riskProfile: "balanced"
      })
    );
  });

  it("returns 400 when extAccountId is only field and empty after trim", async () => {
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extAccountId: "" })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(400);
    expect(repoMocks.adminUpdatePortfolioAccount).not.toHaveBeenCalled();
  });

  it("returns 403 when session gate fails", async () => {
    authMocks.requireAdminSession.mockResolvedValueOnce(
      NextResponse.json({ error: "Forbidden" }, { status: 403 })
    );
    const req = new Request(
      `http://test/api/admin/portfolios/${portfolioId}/accounts/${accountId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "x" })
      }
    );
    const res = await patchAdminPortfolioAccount(req, {
      params: Promise.resolve({ portfolioId, accountId })
    });
    expect(res.status).toBe(403);
    expect(repoMocks.adminUpdatePortfolioAccount).not.toHaveBeenCalled();
  });
});
