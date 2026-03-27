import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn()
}));

const bffMocks = vi.hoisted(() => ({
  proxyRequestToBackend: vi.fn<(request: Request) => Promise<Response | null>>()
}));

const tenantLimitsMocks = vi.hoisted(() => ({
  getResolvedWorkspaceLimitsForTenantId: vi.fn()
}));

const coreAdminMocks = vi.hoisted(() => ({
  adminCreatePortfolio: vi.fn(),
  countPortfoliosForUserInTenant: vi.fn(),
  adminGetPortfolioById: vi.fn(),
  adminInsertAccountForPortfolio: vi.fn(),
  countPortfolioAccountsForUser: vi.fn()
}));

vi.mock("@/lib/api-auth", () => authMocks);
vi.mock("@/lib/backend-bff", () => ({
  proxyRequestToBackend: bffMocks.proxyRequestToBackend
}));
vi.mock("@/lib/tenant-workspace-limits", () => tenantLimitsMocks);
vi.mock("@/modules/core-admin/repository", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/modules/core-admin/repository")>();
  return {
    ...actual,
    adminCreatePortfolio: coreAdminMocks.adminCreatePortfolio,
    countPortfoliosForUserInTenant: coreAdminMocks.countPortfoliosForUserInTenant,
    adminGetPortfolioById: coreAdminMocks.adminGetPortfolioById,
    adminInsertAccountForPortfolio: coreAdminMocks.adminInsertAccountForPortfolio,
    countPortfolioAccountsForUser: coreAdminMocks.countPortfolioAccountsForUser
  };
});

import { POST as postAdminPortfolioAccount } from "@/app/api/admin/portfolios/[portfolioId]/accounts/route";
import { POST as postAdminPortfolio } from "@/app/api/admin/portfolios/route";

const DEFAULT_LIMITS = {
  userXoptionsLimit: 10,
  userChatLimit: 10,
  tenantPortfolioLimit: 1,
  portfolioAccountLimit: 1
};

const portfolioId = "507f1f77bcf86cd799439033";
const userId = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439022";

describe("workspace limit enforcement on admin portfolio routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bffMocks.proxyRequestToBackend.mockResolvedValue(null);
    authMocks.requireAdminSession.mockResolvedValue({
      userId,
      tenantId,
      email: "admin@test.local",
      username: "admin1",
      roles: ["global_admin"],
      tenantRole: "tenant_admin",
      xUserId: "x1"
    });
    tenantLimitsMocks.getResolvedWorkspaceLimitsForTenantId.mockResolvedValue(DEFAULT_LIMITS);
  });

  it("POST /api/admin/portfolios returns 403 workspace_tenant_portfolio_limit_exceeded when at cap", async () => {
    coreAdminMocks.adminCreatePortfolio.mockResolvedValue(null);
    coreAdminMocks.countPortfoliosForUserInTenant.mockResolvedValue(1);

    const req = new Request("http://test/api/admin/portfolios", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, name: "Second book" })
    });

    const res = await postAdminPortfolio(req);
    expect(res.status).toBe(403);
    const json = (await res.json()) as { code: string; error: string };
    expect(json.code).toBe("workspace_tenant_portfolio_limit_exceeded");
    expect(json.error).toContain("Tenant portfolio limit");
    expect(tenantLimitsMocks.getResolvedWorkspaceLimitsForTenantId).toHaveBeenCalledWith(tenantId);
    expect(coreAdminMocks.countPortfoliosForUserInTenant).toHaveBeenCalledWith({
      userId,
      tenantId
    });
  });

  it("POST /api/admin/portfolios/[portfolioId]/accounts returns 403 workspace_portfolio_account_limit_exceeded when at cap", async () => {
    const pid = new ObjectId(portfolioId);
    const tid = new ObjectId(tenantId);

    coreAdminMocks.adminGetPortfolioById.mockResolvedValue({
      _id: pid,
      name: "Default",
      userId,
      tenantId: tid,
      isDefault: true,
      tenantPortfolioOrgKey: "org-atx",
      createdAt: new Date(),
      updatedAt: new Date()
    });
    coreAdminMocks.adminInsertAccountForPortfolio.mockResolvedValue(null);
    coreAdminMocks.countPortfolioAccountsForUser.mockResolvedValue(1);

    const req = new Request(`http://test/api/admin/portfolios/${portfolioId}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Second account" })
    });

    const res = await postAdminPortfolioAccount(req, { params: Promise.resolve({ portfolioId }) });
    expect(res.status).toBe(403);
    const json = (await res.json()) as { code: string; error: string };
    expect(json.code).toBe("workspace_portfolio_account_limit_exceeded");
    expect(json.error).toContain("Account limit reached");
    expect(tenantLimitsMocks.getResolvedWorkspaceLimitsForTenantId).toHaveBeenCalledWith(tenantId);
  });
});
