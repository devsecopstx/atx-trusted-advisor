import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyAdminUsersRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const repoMocks = vi.hoisted(() => ({
  adminListPortfoliosWithStats: vi.fn(),
  adminCreatePortfolio: vi.fn()
}));

const identityMocks = vi.hoisted(() => ({
  getCoreUsersByIds: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
}));
vi.mock("@/lib/backend-bff", () => ({
  proxyAdminUsersRequestToBackend: bffMocks.proxyAdminUsersRequestToBackend
}));
vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    adminListPortfoliosWithStats: repoMocks.adminListPortfoliosWithStats,
    adminCreatePortfolio: repoMocks.adminCreatePortfolio
  };
});
vi.mock("@/modules/identity/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/identity/repository")>();
  return {
    ...actual,
    getCoreUsersByIds: identityMocks.getCoreUsersByIds
  };
});

import { GET as getAdminPortfolios, POST as postAdminPortfolio } from "@/app/api/admin/portfolios/route";

const userId = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439022";
const portfolioOid = new ObjectId("507f1f77bcf86cd799439033");

function mockListRow() {
  const now = new Date("2026-01-10T10:00:00.000Z");
  return {
    _id: portfolioOid,
    tenantId: new ObjectId(tenantId),
    userId,
    name: "Primary book",
    isDefault: true,
    tenantPortfolioOrgKey: "org-atx-finance",
    scoringFactors: undefined,
    createdAt: now,
    updatedAt: now,
    accountCount: 2,
    totalCashBalance: 50_000
  };
}

describe("GET /api/admin/portfolios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyAdminUsersRequestToBackend.mockResolvedValue(null);
    authMocks.requireAdminSession.mockResolvedValue({
      userId,
      tenantId,
      email: "admin@test.local",
      username: "admin1",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    repoMocks.adminListPortfoliosWithStats.mockResolvedValue([mockListRow()]);
    identityMocks.getCoreUsersByIds.mockResolvedValue(
      new Map([
        [
          userId,
          {
            _id: new ObjectId(userId),
            email: "owner@test.local",
            roles: ["viewer"] as const,
            subscriptionPlan: "basic" as const,
            status: "active" as const,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      ])
    );
  });

  it("returns 200 with portfolio list and user fields", async () => {
    const req = new Request("http://test/api/admin/portfolios");
    const res = await getAdminPortfolios(req);
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      data: Array<{
        _id: string;
        name: string;
        userId: string;
        accountCount: number;
        userDisplayName: string;
        userEmail: string | null;
      }>;
    };
    expect(json.data).toHaveLength(1);
    expect(json.data[0]._id).toBe(portfolioOid.toHexString());
    expect(json.data[0].name).toBe("Primary book");
    expect(json.data[0].accountCount).toBe(2);
    expect(json.data[0].userDisplayName).toBe("owner@test.local");
    expect(json.data[0].userEmail).toBe("owner@test.local");
    expect(repoMocks.adminListPortfoliosWithStats).toHaveBeenCalledWith({
      limit: 200,
      listScope: { mode: "scoped", userId, tenantId }
    });
  });
});

describe("POST /api/admin/portfolios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyAdminUsersRequestToBackend.mockResolvedValue(null);
    authMocks.requireAdminSession.mockResolvedValue({
      userId,
      tenantId,
      email: "admin@test.local",
      username: "admin1",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
  });

  it("returns 201 with created portfolio when adminCreatePortfolio succeeds", async () => {
    const now = new Date("2026-01-12T12:00:00.000Z");
    const createdId = new ObjectId("507f1f77bcf86cd799439044");
    repoMocks.adminCreatePortfolio.mockResolvedValue({
      _id: createdId,
      tenantId: new ObjectId(tenantId),
      userId,
      name: "Secondary book",
      isDefault: false,
      tenantPortfolioOrgKey: "org-atx-finance",
      createdAt: now,
      updatedAt: now
    });

    const req = new Request("http://test/api/admin/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: "Secondary book" })
    });
    const res = await postAdminPortfolio(req);
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { _id: string; name: string } };
    expect(json.data._id).toBe(createdId.toHexString());
    expect(json.data.name).toBe("Secondary book");
    expect(repoMocks.adminCreatePortfolio).toHaveBeenCalledWith({
      userId,
      tenantId,
      name: "Secondary book",
      isDefault: undefined,
      initialScoringFactors: undefined
    });
  });
});
