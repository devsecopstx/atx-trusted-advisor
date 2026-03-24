import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  adminUpdatePortfolio: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/modules/core-admin/repository", () => ({
  adminUpdatePortfolio: repoMocks.adminUpdatePortfolio,
  adminGetPortfolioById: vi.fn(),
  adminListAccountsForPortfolio: vi.fn(),
  adminDeletePortfolio: vi.fn(),
  DEFAULT_ACCOUNT_CASH_BALANCE: 25_000
}));

import { PATCH as patchAdminPortfolio } from "@/app/api/admin/portfolios/[portfolioId]/route";

const portfolioId = "507f1f77bcf86cd799439033";

function mockPortfolio(overrides: Partial<{ outlook: string | null }> = {}) {
  const now = new Date("2026-01-15T12:00:00.000Z");
  return {
    _id: new ObjectId(portfolioId),
    tenantId: new ObjectId("507f1f77bcf86cd799439022"),
    userId: "user-1",
    name: "Book A",
    isDefault: true,
    riskProfile: "balanced" as const,
    outlook: overrides.outlook ?? "Risk-on",
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
    repoMocks.adminUpdatePortfolio.mockImplementation(
      async (input: {
        portfolioId: string;
        riskProfile?: "conservative" | "balanced" | "growth" | null;
        outlook?: string | null;
      }) => {
        if (input.portfolioId !== portfolioId) {
          return null;
        }
        const base = mockPortfolio();
        return {
          ...base,
          ...(input.riskProfile !== undefined ? { riskProfile: input.riskProfile ?? undefined } : {}),
          ...(input.outlook !== undefined ? { outlook: input.outlook } : {})
        };
      }
    );
  });

  it("updates riskProfile and outlook when provided", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskProfile: "growth", outlook: "Cautious near-term" })
    });
    const res = await patchAdminPortfolio(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: { riskProfile: string | null; outlook: string | null };
    };
    expect(json.data.riskProfile).toBe("growth");
    expect(json.data.outlook).toBe("Cautious near-term");
    expect(repoMocks.adminUpdatePortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        riskProfile: "growth",
        outlook: "Cautious near-term"
      })
    );
  });

  it("accepts clearing outlook with null", async () => {
    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outlook: null })
    });
    const res = await patchAdminPortfolio(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(200);
    expect(repoMocks.adminUpdatePortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId,
        outlook: null
      })
    );
  });
});
