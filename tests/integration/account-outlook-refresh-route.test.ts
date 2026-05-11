import { ObjectId } from "mongodb";
import { NextResponse } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.XAI_API_KEY = process.env.XAI_API_KEY ?? "test";
  process.env.XAI_MANAGEMENT_API_KEY = process.env.XAI_MANAGEMENT_API_KEY ?? "test";
  process.env.X_OAUTH_CLIENT_ID = process.env.X_OAUTH_CLIENT_ID ?? "cid";
  process.env.X_OAUTH_CLIENT_SECRET = process.env.X_OAUTH_CLIENT_SECRET ?? "sec";
  process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? "01234567890123456789012345678901";
  process.env.INVESTMENT_OUTLOOK_REFRESH_ENABLED = "true";
});

const sessionMocks = vi.hoisted(() => ({
  requireSessionUser: vi.fn()
}));

const repoMocks = vi.hoisted(() => ({
  listPortfolioAccounts: vi.fn(),
  refreshPortfolioAccountInvestmentOutlookForUser: vi.fn(),
  getPortfolioAccountByIdForSessionUser: vi.fn()
}));

const auditMocks = vi.hoisted(() => {
  const createAuditEvent = vi.fn();
  return { createAuditEvent };
});

const portfolioAccessMocks = vi.hoisted(() => ({
  requireAccountInPortfolio: vi.fn()
}));

const flagMocks = vi.hoisted(() => ({
  getInvestmentOutlookRefreshEnabled: vi.fn()
}));

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireSessionUser: sessionMocks.requireSessionUser
  };
});

vi.mock("@/lib/backend-bff", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/backend-bff")>();
  return {
    ...actual,
    proxyPortfolioRequestToBackend: vi.fn().mockResolvedValue(null)
  };
});

vi.mock("@/lib/feature-flags", () => ({
  getInvestmentOutlookRefreshEnabled: flagMocks.getInvestmentOutlookRefreshEnabled
}));

vi.mock("@/lib/portfolio-access", () => ({
  requireAccountInPortfolio: portfolioAccessMocks.requireAccountInPortfolio
}));

vi.mock("@/lib/server-request-cache", () => ({
  getTenantByHexIdCached: vi.fn().mockResolvedValue(null)
}));

vi.mock("@/lib/tenant-workspace-limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tenant-workspace-limits")>();
  const { DEFAULT_TENANT_WORKSPACE_LIMITS } = await import("@/modules/identity/tenant-workspace-limits");
  return {
    ...actual,
    effectiveWorkspaceLimitsForTenantAndPlan: vi.fn().mockResolvedValue(DEFAULT_TENANT_WORKSPACE_LIMITS)
  };
});

vi.mock("@/modules/audit/repository", () => ({
  createAuditEvent: auditMocks.createAuditEvent
}));

vi.mock("@/modules/core-admin/repository", async () => {
  const actual = await vi.importActual<typeof import("@/modules/core-admin/repository")>(
    "@/modules/core-admin/repository"
  );
  return {
    ...actual,
    ...repoMocks
  };
});

vi.mock("@/modules/identity/repository", () => ({
  getCoreUserById: vi.fn().mockResolvedValue({ subscriptionPlan: "basic" })
}));

describe("POST /api/portfolios/[portfolioId]/accounts/[accountId]/outlook/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: new ObjectId().toHexString(),
      email: "u@example.com",
      roles: ["viewer"],
      tenantId: new ObjectId().toHexString(),
      tenantRole: "member",
      xUserId: "1",
      username: "u"
    });
    portfolioAccessMocks.requireAccountInPortfolio.mockResolvedValue(null);
    flagMocks.getInvestmentOutlookRefreshEnabled.mockReturnValue(true);
    repoMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: new ObjectId(),
        outlook: "neutral"
      }
    ]);
    repoMocks.refreshPortfolioAccountInvestmentOutlookForUser.mockResolvedValue({
      _id: new ObjectId(),
      outlook: "neutral",
      outlookConfidence: 0.82,
      lastOutlookRefreshAt: new Date("2026-05-10T14:00:00.000Z")
    });
  });

  it("returns 403 when feature flag helper denies", async () => {
    flagMocks.getInvestmentOutlookRefreshEnabled.mockReturnValue(false);
    const { POST } = await import(
      "@/app/api/portfolios/[portfolioId]/accounts/[accountId]/outlook/refresh/route"
    );
    const res = await POST(new Request("http://localhost/api/x"), {
      params: Promise.resolve({
        portfolioId: new ObjectId().toHexString(),
        accountId: new ObjectId().toHexString()
      })
    });
    expect(res.status).toBe(403);
    expect(repoMocks.refreshPortfolioAccountInvestmentOutlookForUser).not.toHaveBeenCalled();
  });

  it("refreshes, returns account payload, and writes audit event", async () => {
    const accountHex = new ObjectId().toHexString();
    const portfolioHex = new ObjectId().toHexString();
    repoMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: new ObjectId(accountHex),
        outlook: "bullish"
      }
    ]);
    const { POST } = await import(
      "@/app/api/portfolios/[portfolioId]/accounts/[accountId]/outlook/refresh/route"
    );
    const res = await POST(
      new Request("http://localhost/api/x", { headers: { "x-correlation-id": "corr-1" } }),
      {
        params: Promise.resolve({
          portfolioId: portfolioHex,
          accountId: accountHex
        })
      }
    );
    expect(res.status).toBe(200);
    expect(repoMocks.refreshPortfolioAccountInvestmentOutlookForUser).toHaveBeenCalledTimes(1);
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "portfolio_account",
        entityId: accountHex,
        action: "investment_outlook_refresh",
        details: expect.objectContaining({
          correlationId: "corr-1",
          trigger: "manual",
          previousOutlook: "bullish"
        })
      })
    );
  });

  it("short-circuits when proxied to backend", async () => {
    const bff = await import("@/lib/backend-bff");
    vi.spyOn(bff, "proxyPortfolioRequestToBackend").mockResolvedValueOnce(
      NextResponse.json({ proxied: true })
    );
    const { POST } = await import(
      "@/app/api/portfolios/[portfolioId]/accounts/[accountId]/outlook/refresh/route"
    );
    const res = await POST(new Request("http://localhost/api/x"), {
      params: Promise.resolve({
        portfolioId: new ObjectId().toHexString(),
        accountId: new ObjectId().toHexString()
      })
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { proxied?: boolean };
    expect(body.proxied).toBe(true);
    expect(repoMocks.refreshPortfolioAccountInvestmentOutlookForUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/accounts/[accountId]/outlook/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auditMocks.createAuditEvent.mockResolvedValue(undefined);
    sessionMocks.requireSessionUser.mockResolvedValue({
      userId: new ObjectId().toHexString(),
      email: "u@example.com",
      roles: ["viewer"],
      tenantId: new ObjectId().toHexString(),
      tenantRole: "member",
      xUserId: "1",
      username: "u"
    });
    flagMocks.getInvestmentOutlookRefreshEnabled.mockReturnValue(true);
    repoMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: new ObjectId(),
        outlook: "neutral"
      }
    ]);
    repoMocks.refreshPortfolioAccountInvestmentOutlookForUser.mockResolvedValue({
      _id: new ObjectId(),
      outlook: "neutral",
      outlookConfidence: 0.82,
      lastOutlookRefreshAt: new Date("2026-05-10T14:00:00.000Z")
    });
  });

  it("returns 404 when account is unknown to session user", async () => {
    repoMocks.getPortfolioAccountByIdForSessionUser.mockResolvedValue(null);
    const { POST } = await import("@/app/api/accounts/[accountId]/outlook/refresh/route");
    const res = await POST(new Request("http://localhost/api/x"), {
      params: Promise.resolve({ accountId: new ObjectId().toHexString() })
    });
    expect(res.status).toBe(404);
    expect(repoMocks.refreshPortfolioAccountInvestmentOutlookForUser).not.toHaveBeenCalled();
  });

  it("delegates to shared refresh handler with resolved portfolio id", async () => {
    const accountHex = new ObjectId().toHexString();
    const portfolioHex = new ObjectId().toHexString();
    repoMocks.getPortfolioAccountByIdForSessionUser.mockResolvedValue({
      _id: new ObjectId(accountHex),
      portfolioId: new ObjectId(portfolioHex)
    });
    repoMocks.listPortfolioAccounts.mockResolvedValue([
      {
        _id: new ObjectId(accountHex),
        outlook: "bullish"
      }
    ]);
    const { POST } = await import("@/app/api/accounts/[accountId]/outlook/refresh/route");
    const res = await POST(
      new Request("http://localhost/api/x", { headers: { "x-correlation-id": "corr-alias" } }),
      {
        params: Promise.resolve({ accountId: accountHex })
      }
    );
    expect(res.status).toBe(200);
    expect(repoMocks.getPortfolioAccountByIdForSessionUser).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: accountHex })
    );
    expect(repoMocks.refreshPortfolioAccountInvestmentOutlookForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        portfolioId: portfolioHex,
        accountId: accountHex
      })
    );
    expect(auditMocks.createAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "portfolio_account",
        entityId: accountHex,
        action: "investment_outlook_refresh",
        details: expect.objectContaining({
          correlationId: "corr-alias",
          trigger: "manual",
          previousOutlook: "bullish"
        })
      })
    );
  });
});
