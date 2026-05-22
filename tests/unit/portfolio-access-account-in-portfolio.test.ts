import { beforeEach, describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listPortfolioAccounts: vi.fn(),
  getPortfolioAccountByIdForSessionUser: vi.fn()
}));

vi.mock("@/modules/core-admin/repository", () => repoMocks);

import { requireAccountInPortfolio } from "@/lib/portfolio-access";

const session = {
  userId: "507f1f77bcf86cd799439011",
  tenantId: "507f1f77bcf86cd799439022",
  email: "advisor@test.local",
  roles: ["advisor"]
} as import("@/lib/auth").SessionUser;

describe("requireAccountInPortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repoMocks.listPortfolioAccounts.mockResolvedValue([]);
  });

  it("allows when account is on portfolio via direct lookup (workspace portfolio list miss)", async () => {
    repoMocks.getPortfolioAccountByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => "69d4f1182a07e0004225506a" },
      portfolioId: { toHexString: () => "507f1f77bcf86cd799439033" }
    });
    const result = await requireAccountInPortfolio(
      session,
      "507f1f77bcf86cd799439033",
      "69d4f1182a07e0004225506a"
    );
    expect(result).toBeNull();
  });

  it("returns 404 when account belongs to another portfolio", async () => {
    repoMocks.getPortfolioAccountByIdForSessionUser.mockResolvedValue({
      _id: { toHexString: () => "69d4f1182a07e0004225506a" },
      portfolioId: { toHexString: () => "aaaaaaaaaaaaaaaaaaaaaaaa" }
    });
    const result = await requireAccountInPortfolio(
      session,
      "507f1f77bcf86cd799439033",
      "69d4f1182a07e0004225506a"
    );
    expect(result).not.toBeNull();
    expect((result as Response).status).toBe(404);
  });
});
