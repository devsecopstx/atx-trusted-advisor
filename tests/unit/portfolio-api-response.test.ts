import { describe, expect, it, vi } from "vitest";

const repoMocks = vi.hoisted(() => ({
  listPortfolioAccounts: vi.fn()
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    listPortfolioAccounts: repoMocks.listPortfolioAccounts
  };
});

import type { SessionUser } from "@/lib/auth";
import { buildPortfolioSummaryPayload } from "@/lib/portfolio-api-response";
import { SCORING_FACTOR_IDS } from "@/modules/core-admin/scoring-factors";

describe("buildPortfolioSummaryPayload", () => {
  it("does not throw when createdAt/updatedAt are missing (legacy / provision read shape)", async () => {
    repoMocks.listPortfolioAccounts.mockResolvedValueOnce([]);
    const session = {
      userId: "507f1f77bcf86cd799439011",
      tenantId: "507f1f77bcf86cd799439022",
      email: "a@b.com",
      roles: ["viewer"],
      tenantRole: "member",
      xUserId: "1",
      username: "u"
    } satisfies SessionUser;

    const portfolio = {
      _id: { toHexString: () => "507f1f77bcf86cd799439033" },
      userId: session.userId,
      name: "Default Portfolio",
      isDefault: true
    } as unknown as import("@/modules/core-admin/types").Portfolio;

    const data = await buildPortfolioSummaryPayload(session, portfolio);
    expect(data._id).toBe("507f1f77bcf86cd799439033");
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(data.scoringFactors).toHaveLength(SCORING_FACTOR_IDS.length);
    expect(data.scoringFactors[0]?.id).toBe("iv_rank");
    expect(data.scoringFactors.every((r) => typeof r.weight === "number")).toBe(true);
  });
});
