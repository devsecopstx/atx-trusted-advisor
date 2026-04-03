import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminUpdatePortfolio: vi.fn(),
  adminGetPortfolioById: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/modules/core-admin/repository", () => ({
  adminUpdatePortfolio: repoMocks.adminUpdatePortfolio,
  adminGetPortfolioById: repoMocks.adminGetPortfolioById,
  adminListAccountsForPortfolio: vi.fn(),
  adminDeletePortfolio: vi.fn(),
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000
}));

import { PATCH as patchAdminPortfolio } from "@/app/api/admin/portfolios/[portfolioId]/route";

const portfolioId = "507f1f77bcf86cd799439033";

function mockPortfolio() {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId(portfolioId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "507f1f77bcf86cd799439011",
    name: "Book A",
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

describe("PATCH /api/admin/portfolios/[portfolioId]", () => {
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
    repoMocks.adminGetPortfolioById.mockResolvedValue(mockPortfolio());
    repoMocks.adminUpdatePortfolio.mockImplementation(
      async (input: {
        portfolioId: string;
        name?: string;
        scoringFactors?: Array<{ id: string; weight: number }> | null;
      }) => {
        if (input.portfolioId !== portfolioId) {
          return null;
        }
        const base = mockPortfolio();
        return {
          ...base,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.scoringFactors !== undefined ? { scoringFactors: input.scoringFactors ?? undefined } : {})
        };
      }
    );
  });

  it("updates name when provided", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Renamed book" })
    });
    const res = await patchAdminPortfolio(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { name: string } };
    expect(json.data.name).toBe("Renamed book");
    expect(repoMocks.adminUpdatePortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        name: "Renamed book"
      })
    );
  });

  it("updates scoringFactors when provided", async () => {
    const factors = [
      { id: "iv_rank", weight: 0.5 },
      { id: "volume", weight: 0.5 }
    ];
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoringFactors: factors })
    });
    const res = await patchAdminPortfolio(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { scoringFactors: Array<{ id: string; weight: number }> } };
    expect(json.data.scoringFactors.some((r) => r.id === "iv_rank")).toBe(true);
    expect(repoMocks.adminUpdatePortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        scoringFactors: factors
      })
    );
  });
});
